// 概要: グローバルマウスフックによるジェスチャー軌跡の収集と認識
// 入出力:
//   - 入力: 低レベルマウスイベント（WM_RBUTTONDOWN, WM_MOUSEMOVE等）
//   - 出力: ジェスチャー軌跡データ、認識されたジェスチャー名のコールバック
// 例: 右クリックドラッグで軌跡収集 -> recognize -> アクション実行

use windows::{
    core::*,
    Win32::Foundation::*,
    Win32::UI::WindowsAndMessaging::*,
    Win32::System::Threading::*,
};
use std::sync::Mutex;

const LLMHF_INJECTED: u32 = 0x00000001;
const SMALL_MOVE_POINTS: usize = 8;

static HOOK_HANDLE: Mutex<Option<isize>> = Mutex::new(None);
static TRAJECTORY: Mutex<Vec<(i32, i32)>> = Mutex::new(Vec::new());
static IS_DRAGGING: Mutex<bool> = Mutex::new(false);
static HANDLED_CLICK: Mutex<bool> = Mutex::new(false);
static IS_LEFT_PRESSED: Mutex<bool> = Mutex::new(false);
static GESTURE_START_WINDOW: Mutex<Option<isize>> = Mutex::new(None);

fn get_window_exe_name(hwnd: HWND) -> Option<String> {
    unsafe {
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
        if process_id == 0 {
            return None;
        }

        let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?;
        let mut exe_path = [0u16; 260];
        let mut size = exe_path.len() as u32;
        
        if QueryFullProcessImageNameW(process_handle, PROCESS_NAME_WIN32, windows::core::PWSTR(exe_path.as_mut_ptr()), &mut size).is_ok() {
            let _ = CloseHandle(process_handle);
            let path_str = String::from_utf16_lossy(&exe_path[..size as usize]);
            std::path::Path::new(&path_str)
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_lowercase())
        } else {
            let _ = CloseHandle(process_handle);
            None
        }
    }
}

fn is_ignored_by_global_config(exe_name: &str) -> bool {
    if let Ok(manager) = crate::config::ConfigManager::new() {
        if let Ok(config) = manager.load_config() {
            return config.ignore_exe.iter().any(|e| e.to_lowercase() == exe_name);
        }
    }
    false
}

unsafe extern "system" fn mouse_hook_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    let mouse_data = *(l_param.0 as *const MSLLHOOKSTRUCT);
    
    if (mouse_data.flags & LLMHF_INJECTED) != 0 {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    let event_type = w_param.0 as u32;

    match event_type {
        WM_LBUTTONDOWN => {
            let mut left_pressed = IS_LEFT_PRESSED.lock().unwrap();
            *left_pressed = true;
            drop(left_pressed);
        }
        WM_LBUTTONUP => {
            let mut left_pressed = IS_LEFT_PRESSED.lock().unwrap();
            *left_pressed = false;
            drop(left_pressed);
        }
        WM_RBUTTONDOWN => {
            eprintln!("[MOUSE_HOOK] WM_RBUTTONDOWN at ({}, {})", mouse_data.pt.x, mouse_data.pt.y);
            let point = POINT { x: mouse_data.pt.x, y: mouse_data.pt.y };
            let window_at_point = WindowFromPoint(point);
            
            let current_window = if window_at_point != HWND::default() {
                let _ = BringWindowToTop(window_at_point);
                let _ = SetForegroundWindow(window_at_point);
                std::thread::sleep(std::time::Duration::from_millis(10));
                window_at_point
            } else {
                GetForegroundWindow()
            };
            
            if current_window != HWND::default() {
                if let Some(exe_name) = get_window_exe_name(current_window) {
                    if is_ignored_by_global_config(&exe_name) {
                        eprintln!("[DEBUG] Gesture detection skipped for global ignore_exe: {}", exe_name);
                        return CallNextHookEx(None, n_code, w_param, l_param);
                    }
                }
            }

            let mut start_window = GESTURE_START_WINDOW.lock().unwrap();
            *start_window = Some(current_window.0 as isize);
            drop(start_window);

            let mut dragging = IS_DRAGGING.lock().unwrap();
            *dragging = true;
            drop(dragging);

            let mut handled = HANDLED_CLICK.lock().unwrap();
            *handled = false;
            drop(handled);

            let mut trajectory = TRAJECTORY.lock().unwrap();
            trajectory.clear();
            trajectory.push((mouse_data.pt.x, mouse_data.pt.y));
            let initial_point = vec![(mouse_data.pt.x, mouse_data.pt.y)];
            drop(trajectory);

            crate::emit_trajectory_update(&initial_point, true);
            return LRESULT(1);
        }
        WM_MOUSEMOVE => {
            let dragging = IS_DRAGGING.lock().unwrap();
            let is_dragging = *dragging;
            drop(dragging);

            if is_dragging {
                eprintln!("[MOUSE_HOOK] WM_MOUSEMOVE at ({}, {}) - dragging", mouse_data.pt.x, mouse_data.pt.y);
                let mut trajectory = TRAJECTORY.lock().unwrap();
                trajectory.push((mouse_data.pt.x, mouse_data.pt.y));
                drop(trajectory);

                eprintln!("[MOUSE_HOOK] Calling append_trajectory_point...");
                crate::append_trajectory_point(mouse_data.pt.x, mouse_data.pt.y);
                eprintln!("[MOUSE_HOOK] append_trajectory_point returned");
            }
        }
        WM_RBUTTONUP => {
            eprintln!("[MOUSE_HOOK] WM_RBUTTONUP at ({}, {})", mouse_data.pt.x, mouse_data.pt.y);
            let mut dragging = IS_DRAGGING.lock().unwrap();
            let was_dragging = *dragging;
            if was_dragging {
                *dragging = false;
                drop(dragging);

                eprintln!("[MOUSE_HOOK] ドラッグ終了 - 軌跡非表示を指示");
                crate::emit_trajectory_update(&[], false);

                let trajectory = TRAJECTORY.lock().unwrap();
                let trajectory_len = trajectory.len();

                if trajectory_len > 0 && crate::is_gesture_enabled_internal() {
                    let points: Vec<(f64, f64)> = trajectory
                        .iter()
                        .map(|(x, y)| (*x as f64, *y as f64))
                        .collect();
                    drop(trajectory);

                    eprintln!("[MOUSE_HOOK] ジェスチャー認識開始 - 軌跡ポイント数: {}", points.len());

                    if let Ok(manager) = crate::config::ConfigManager::new() {
                        if let Ok(templates) = manager.load_gestures() {
                            eprintln!("[MOUSE_HOOK] テンプレート読込成功: {}個", templates.len());
                            if let Some(gesture_name) = crate::gesture_recognizer::recognize(&points, &templates) {
                                eprintln!("[MOUSE_HOOK] ✓ ジェスチャー認識成功: {}", gesture_name);
                                if let Ok(config) = manager.load_config() {
                                    if let Some(action) = config.actions.iter().find(|a| {
                                        (a.trigger_type.is_empty() || a.trigger_type == "gesture") && a.gesture == gesture_name
                                    }) {
                                        let start_window = GESTURE_START_WINDOW.lock().unwrap();
                                        let target_hwnd = start_window.map(|h| HWND(h as *mut _));
                                        drop(start_window);

                                        if let Some(hwnd) = target_hwnd {
                                            if let Some(exe_name) = get_window_exe_name(hwnd) {
                                                if let Some(ref ignore_list) = action.ignore_exe {
                                                    if ignore_list.iter().any(|e| e.to_lowercase() == exe_name) {
                                                        eprintln!("[DEBUG] Action skipped for action-level ignore_exe: {}", exe_name);
                                                        let mut handled = HANDLED_CLICK.lock().unwrap();
                                                        *handled = true;
                                                        drop(handled);
                                                        
                                                        let mut trajectory = TRAJECTORY.lock().unwrap();
                                                        trajectory.clear();
                                                        drop(trajectory);
                                                        return LRESULT(1);
                                                    }
                                                }
                                            }
                                        }

                                        eprintln!("[DEBUG] Executing action: type={:?}", action.action_type);
                                        let _ = crate::command_executor::execute_action_with_window(action, target_hwnd, true);
                                        crate::emit_gesture_recognized(&gesture_name, Some(&action.action_type));
                                        
                                        let mut handled = HANDLED_CLICK.lock().unwrap();
                                        *handled = true;
                                        drop(handled);
                                    }
                                }
                            } else {
                                eprintln!("[MOUSE_HOOK] ✗ ジェスチャー未認識 - テンプレートマッチなし");
                                if points.len() <= SMALL_MOVE_POINTS {
                                    eprintln!("[MOUSE_HOOK] 小さい移動と判定 ({}点 <= {}点), 右クリック送信", 
                                        points.len(), SMALL_MOVE_POINTS);
                                    let mouse_pos = points[0];
                                    std::thread::spawn(move || {
                                        std::thread::sleep(std::time::Duration::from_millis(10));
                                        crate::command_executor::send_right_click(mouse_pos.0 as i32, mouse_pos.1 as i32);
                                    });
                                    
                                    let mut handled = HANDLED_CLICK.lock().unwrap();
                                    *handled = false;
                                    drop(handled);
                                } else {
                                    eprintln!("[MOUSE_HOOK] 大きい移動だが認識失敗 ({}点 > {}点), イベント破棄", 
                                        points.len(), SMALL_MOVE_POINTS);
                                    let mut handled = HANDLED_CLICK.lock().unwrap();
                                    *handled = true;
                                    drop(handled);
                                }
                            }
                        }
                    }
                } else {
                    drop(trajectory);
                }

                let mut trajectory = TRAJECTORY.lock().unwrap();
                let cleared_count = trajectory.len();
                trajectory.clear();
                drop(trajectory);
                eprintln!("[MOUSE_HOOK] 軌跡データクリア完了 ({}点を削除)", cleared_count);
                return LRESULT(1);
            } else {
                drop(dragging);
            }
        }        WM_MOUSEWHEEL => {
            let dragging = IS_DRAGGING.lock().unwrap();
            let is_dragging = *dragging;
            drop(dragging);

            if is_dragging {
                let left_pressed = IS_LEFT_PRESSED.lock().unwrap();
                let is_left_pressed = *left_pressed;
                drop(left_pressed);

                let wheel_delta = ((mouse_data.mouseData >> 16) & 0xFFFF) as i16;
                let wheel_direction = if wheel_delta > 0 { "up" } else { "down" };
                
                let wheel_trigger = if is_left_pressed {
                    format!("leftclick_wheel_{}", wheel_direction)
                } else {
                    format!("wheel_{}", wheel_direction)
                };

                eprintln!("[DEBUG] Wheel event: trigger={}", wheel_trigger);

                if let Ok(manager) = crate::config::ConfigManager::new() {
                    if let Ok(config) = manager.load_config() {
                        if let Some(action) = config.actions.iter().find(|a| {
                            a.trigger_type == "wheel" && a.wheel_trigger.as_ref().map_or(false, |wt| wt == &wheel_trigger)
                        }) {
                            let start_window = GESTURE_START_WINDOW.lock().unwrap();
                            let target_hwnd = start_window.map(|h| HWND(h as *mut _));
                            drop(start_window);

                            if let Some(hwnd) = target_hwnd {
                                if let Some(exe_name) = get_window_exe_name(hwnd) {
                                    if let Some(ref ignore_list) = action.ignore_exe {
                                        if ignore_list.iter().any(|e| e.to_lowercase() == exe_name) {
                                            eprintln!("[DEBUG] Wheel action skipped for action-level ignore_exe: {}", exe_name);
                                            return LRESULT(1);
                                        }
                                    }
                                }
                            }

                            eprintln!("[DEBUG] Executing wheel action: type={:?}", action.action_type);
                            let _ = crate::command_executor::execute_action_with_window(action, target_hwnd, false);
                            
                            let mut trajectory = TRAJECTORY.lock().unwrap();
                            trajectory.clear();
                            drop(trajectory);
                            
                            let mut handled = HANDLED_CLICK.lock().unwrap();
                            *handled = true;
                            drop(handled);
                        } else {
                            eprintln!("[DEBUG] No action found for wheel trigger: {}", wheel_trigger);
                        }
                    }
                }

                return LRESULT(1);
            }
        }
        WM_MBUTTONDOWN => {
            let dragging = IS_DRAGGING.lock().unwrap();
            let is_dragging = *dragging;
            drop(dragging);

            if is_dragging {
                eprintln!("[DEBUG] Middle button click while right button pressed");

                if let Ok(manager) = crate::config::ConfigManager::new() {
                    if let Ok(config) = manager.load_config() {
                        if let Some(action) = config.actions.iter().find(|a| {
                            a.trigger_type == "wheel" && a.wheel_trigger.as_ref().map_or(false, |wt| wt == "wheel_click")
                        }) {
                            let start_window = GESTURE_START_WINDOW.lock().unwrap();
                            let target_hwnd = start_window.map(|h| HWND(h as *mut _));
                            drop(start_window);

                            if let Some(hwnd) = target_hwnd {
                                if let Some(exe_name) = get_window_exe_name(hwnd) {
                                    if let Some(ref ignore_list) = action.ignore_exe {
                                        if ignore_list.iter().any(|e| e.to_lowercase() == exe_name) {
                                            eprintln!("[DEBUG] Middle click action skipped for action-level ignore_exe: {}", exe_name);
                                            return LRESULT(1);
                                        }
                                    }
                                }
                            }

                            eprintln!("[DEBUG] Executing middle click action: type={:?}", action.action_type);
                            let _ = crate::command_executor::execute_action_with_window(action, target_hwnd, false);
                            
                            let mut trajectory = TRAJECTORY.lock().unwrap();
                            trajectory.clear();
                            drop(trajectory);
                            
                            let mut handled = HANDLED_CLICK.lock().unwrap();
                            *handled = true;
                            drop(handled);
                        } else {
                            eprintln!("[DEBUG] No action found for wheel_click");
                        }
                    }
                }

                return LRESULT(1);
            }
        }
        WM_XBUTTONDOWN => {
            let dragging = IS_DRAGGING.lock().unwrap();
            let is_dragging = *dragging;
            drop(dragging);

            if is_dragging {
                let x_button = (mouse_data.mouseData >> 16) & 0xFFFF;
                let button_trigger = if x_button == 1 {
                    "x1_button"
                } else if x_button == 2 {
                    "x2_button"
                } else {
                    return CallNextHookEx(None, n_code, w_param, l_param);
                };

                eprintln!("[DEBUG] X button click while right button pressed: trigger={}", button_trigger);

                if let Ok(manager) = crate::config::ConfigManager::new() {
                    if let Ok(config) = manager.load_config() {
                        if let Some(action) = config.actions.iter().find(|a| {
                            a.trigger_type == "wheel" && a.wheel_trigger.as_ref().map_or(false, |wt| wt == button_trigger)
                        }) {
                            let start_window = GESTURE_START_WINDOW.lock().unwrap();
                            let target_hwnd = start_window.map(|h| HWND(h as *mut _));
                            drop(start_window);

                            if let Some(hwnd) = target_hwnd {
                                if let Some(exe_name) = get_window_exe_name(hwnd) {
                                    if let Some(ref ignore_list) = action.ignore_exe {
                                        if ignore_list.iter().any(|e| e.to_lowercase() == exe_name) {
                                            eprintln!("[DEBUG] X button action skipped for action-level ignore_exe: {}", exe_name);
                                            return LRESULT(1);
                                        }
                                    }
                                }
                            }

                            eprintln!("[DEBUG] Executing X button action: type={:?}", action.action_type);
                            let _ = crate::command_executor::execute_action_with_window(action, target_hwnd, false);
                            
                            let mut trajectory = TRAJECTORY.lock().unwrap();
                            trajectory.clear();
                            drop(trajectory);
                            
                            let mut handled = HANDLED_CLICK.lock().unwrap();
                            *handled = true;
                            drop(handled);
                        } else {
                            eprintln!("[DEBUG] No action found for trigger: {}", button_trigger);
                        }
                    }
                }

                return LRESULT(1);
            }
        }
        _ => {}
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

pub fn install_hook() -> Result<()> {
    unsafe {
        let hook = SetWindowsHookExW(
            WH_MOUSE_LL,
            Some(mouse_hook_proc),
            None,
            0,
        )?;

        let mut hook_handle = HOOK_HANDLE.lock().unwrap();
        *hook_handle = Some(hook.0 as isize);
    }
    Ok(())
}

pub fn uninstall_hook() -> Result<()> {
    unsafe {
        let mut hook_handle = HOOK_HANDLE.lock().unwrap();
        if let Some(handle) = *hook_handle {
            UnhookWindowsHookEx(HHOOK(handle as *mut _))?;
            *hook_handle = None;
        }
    }
    Ok(())
}

// Web lock helpers. The real passcode lives only in server env (APP_PIN).
// When APP_PIN is unset the API reports demo mode and PinGate stays open.

export const PIN_LENGTH = 6

const KEY_AUTHED = 'lm.pin.authed'

export function isDeviceAuthed() {
  try {
    return localStorage.getItem(KEY_AUTHED) === 'true'
  } catch {
    return false
  }
}

export function rememberDevice() {
  try {
    localStorage.setItem(KEY_AUTHED, 'true')
  } catch {
    /* best-effort */
  }
}

export function forgetDevice() {
  try {
    localStorage.removeItem(KEY_AUTHED)
  } catch {
    /* noop */
  }
}

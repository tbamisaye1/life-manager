// App passcode — mirrors the mobile gate (same 6-digit code).
// Once this browser unlocks successfully we remember it in localStorage and
// the server sets an httpOnly cookie so /api/* stays closed to strangers.

export const PIN_LENGTH = 6
export const EXPECTED_PIN = ''

const KEY_AUTHED = 'lm.pin.authed'

export function checkPin(entered) {
  return entered === EXPECTED_PIN
}

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

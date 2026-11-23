import * as Device from "expo-device";

// Native only: expo-device drags ua-parser-js along, and the web build resolves
// is-real-device.web.ts instead so neither ships to the browser.
export function isRealDevice(): boolean {
  return Device.isDevice;
}

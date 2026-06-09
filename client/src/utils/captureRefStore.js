// Module-level store — lives outside React, never loses the ref
let _captureRef = null;

export const setCaptureRef = (ref) => { _captureRef = ref; };
export const getCaptureRef = () => _captureRef;
export const clearCaptureRef = () => { _captureRef = null; };
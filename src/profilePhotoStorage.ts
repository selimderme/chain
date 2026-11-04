import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Store a small square image rather than a temporary picker URI. */
export async function prepareProfilePhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri, {maxWidth:800, maxHeight:800});
  let source: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let output: typeof source;
  try {
    source = await context.renderAsync();
    const side = Math.min(source.width, source.height);
    if (!Number.isFinite(side) || side <= 0) throw new Error('Invalid image');
    context.crop({originX:Math.floor((source.width-side)/2), originY:Math.floor((source.height-side)/2), width:side, height:side}).resize({width:320,height:320});
    output = await context.renderAsync();
    const photo = await output.saveAsync({format:SaveFormat.JPEG, compress:0.75, base64:true});
    if (!photo.base64 || photo.base64.length > 350000) throw new Error('Invalid image');
    return `data:image/jpeg;base64,${photo.base64}`;
  } finally {
    output?.release(); source?.release(); context.release();
  }
}

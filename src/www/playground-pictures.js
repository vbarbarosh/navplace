// The Playground's pictures made again in other formats, away from the page's thread: a module worker.
// In: {id, blob} or {id, url} (a data url), with quality (0..1), side_max and url_max. Out, for each format as it goes:
// {id, value, label, state: 'working' | 'done' | 'failed', url, width, height, note}; then {id, state: 'end'}.
// The size that counts is the data url's length, the characters links.txt takes.

// AVIF, when the browser draws none itself: Squoosh's libavif (@jsquash/avif 2.1.1), loaded on first use
const AVIF_ENCODER_URL = '/lib/vendor/jsquash-avif-2/avif_enc.js';
const FORMATS = [
    {value: 'webp', label: 'WebP', type: 'image/webp'},
    {value: 'avif', label: 'AVIF', type: 'image/avif'},
    {value: 'jpeg', label: 'JPEG', type: 'image/jpeg', opaque: true},
    {value: 'png', label: 'PNG', type: 'image/png'},
];

let avif_module_promise = null;

self.addEventListener('message', function (event) {
    formats_make(event.data).catch(function (error) {
        self.postMessage({id: event.data.id, value: 'original', state: 'failed', note: error.message});
    }).finally(function () {
        self.postMessage({id: event.data.id, state: 'end'});
    });
});

async function formats_make({id, blob, url, quality, side_max, url_max})
{
    const source = blob ?? await (await fetch(url)).blob();
    const original_url = url ?? new FileReaderSync().readAsDataURL(source);
    let bitmap = null;
    try {
        bitmap = await createImageBitmap(source);
    }
    catch {
        self.postMessage({id, value: 'original', label: label_from_type(source.type), state: 'done', url: original_url, width: 0, height: 0, note: 'as it is'});
        for (const format of FORMATS) {
            self.postMessage({id, value: format.value, label: format.label, state: 'failed', note: 'the browser cannot draw this picture again'});
        }
        return;
    }
    self.postMessage({id, value: 'original', label: label_from_type(source.type), state: 'done', url: original_url, width: bitmap.width, height: bitmap.height, note: 'as it is'});

    const scale = Math.min(1, side_max/Math.max(bitmap.width, bitmap.height));
    const canvas = canvas_from_bitmap(bitmap, scale);
    const transparent = canvas_is_transparent(canvas);
    for (const format of FORMATS) {
        self.postMessage({id, value: format.value, label: format.label, state: 'working'});
    }
    let smallest = {url: original_url, format: null};
    for (const format of FORMATS) {
        if (format.opaque && transparent) {
            self.postMessage({id, value: format.value, label: format.label, state: 'failed', note: 'the picture has transparency'});
            continue;
        }
        try {
            const out_url = new FileReaderSync().readAsDataURL(await blob_from_canvas(canvas, format, quality));
            self.postMessage({id, value: format.value, label: format.label, state: 'done', url: out_url, width: canvas.width, height: canvas.height, note: ''});
            if (out_url.length < smallest.url.length) {
                smallest = {url: out_url, format};
            }
        }
        catch (error) {
            self.postMessage({id, value: format.value, label: format.label, state: 'failed', note: error.message});
        }
    }

    // Nothing fits links.txt: the smallest format drawn smaller, a quarter less a side each time
    if (smallest.url.length <= url_max) {
        return;
    }
    const format = smallest.format ?? FORMATS[0];
    let side = Math.floor(Math.max(canvas.width, canvas.height)*0.75);
    while (side >= 32) {
        const smaller = canvas_from_bitmap(bitmap, side/Math.max(bitmap.width, bitmap.height));
        const out_url = new FileReaderSync().readAsDataURL(await blob_from_canvas(smaller, format, quality));
        if (out_url.length <= url_max) {
            self.postMessage({id, value: 'smaller', label: `${format.label} ${smaller.width}×${smaller.height}`, state: 'done', url: out_url, width: smaller.width, height: smaller.height, note: 'drawn smaller to fit'});
            return;
        }
        side = Math.floor(side*0.75);
    }
}

function canvas_from_bitmap(bitmap, scale)
{
    const out = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width*scale)), Math.max(1, Math.round(bitmap.height*scale)));
    out.getContext('2d').drawImage(bitmap, 0, 0, out.width, out.height);
    return out;
}

function canvas_is_transparent(canvas)
{
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3, end = data.length; i < end; i += 4) {
        if (data[i] < 255) {
            return true;
        }
    }
    return false;
}

// The browser's own encoder; AVIF from libavif when the browser has none (it hands back a PNG instead)
async function blob_from_canvas(canvas, format, quality)
{
    const blob = await canvas.convertToBlob({type: format.type, quality});
    if (blob.type === format.type) {
        return blob;
    }
    if (format.value !== 'avif') {
        throw new Error(`the browser makes no ${format.label}`);
    }
    const module = await avif_module_load();
    const image_data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    // libavif's quality: 100 is the best, 0 the worst
    const options = {quality: Math.round(100*quality), qualityAlpha: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0, speed: 6, subsample: 1, chromaDeltaQ: false, sharpness: 0, tune: 0, enableSharpYUV: false, bitDepth: 8};
    const bytes = module.encode(new Uint8Array(image_data.data.buffer), image_data.width, image_data.height, options);
    if (!bytes) {
        throw new Error('AVIF could not be made');
    }
    return new Blob([bytes], {type: 'image/avif'});
}

function avif_module_load()
{
    if (!avif_module_promise) {
        avif_module_promise = import(AVIF_ENCODER_URL).then(v => v.default({noInitialRun: true}));
        avif_module_promise.catch(function () {
            avif_module_promise = null;
        });
    }
    return avif_module_promise;
}

function label_from_type(type)
{
    const label = {'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/avif': 'AVIF', 'image/gif': 'GIF', 'image/svg+xml': 'SVG'}[type];
    return label ? `${label}, as it is` : 'as it is';
}

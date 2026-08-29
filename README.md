# Preview to GIF

A static GitHub Pages app that converts the repository's short video previews to GIFs in the browser. Files stay on the device; there is no upload service or backend.

## Use on GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
3. Open the Pages URL GitHub provides. The app uses relative asset paths, so project Pages URLs work.

Choose a checked-in preview, or choose/drop a local `.mov`, `.mp4`, or `.webm`. Adjust the trim, width, frame rate, quality, and loop settings, then select **Convert to GIF** and download the result.

## Test locally

Serve the repository over HTTP (opening `index.html` directly will prevent the manifest from loading):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Notes

- Conversion is performed locally with the browser's video decoder, canvas, and a vendored `gif.js` encoder. Video files are not sent anywhere.
- GIFs have no audio and use a 256-color palette. Lowering width, frame rate, or clip length produces smaller files.
- The app limits output width to 480 pixels and output to 300 frames to avoid exhausting browser memory.
- Browser support for QuickTime containers and codecs varies. Most H.264 previews work in modern browsers; `Purplepills.mov` uses HEVC and may require Safari. If a preview cannot load, use an H.264 MP4/WebM copy or a different browser.
- The `.tendies` files in `downloads/` are not used by this converter.
- Generated GIFs are held in memory and are not added to the repository.

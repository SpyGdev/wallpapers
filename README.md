# wallpapers

## Convert previews to GIF

This repository includes a GitHub Actions workflow that converts every video in `previews/` into a downloadable GIF.

### Run it

1. Open the repository's **Actions** tab on GitHub.
2. Select **Convert previews to GIF**.
3. Choose **Run workflow** and confirm.
4. When the job finishes, open the run summary and download the **preview-gifs** artifact.

The workflow also runs automatically when a `.mov` file is added or changed under `previews/`.

### Output

Each source produces a GIF with the same filename stem—for example, `previews/Snoopy 2.mov` becomes `Snoopy 2.gif`. Conversion uses FFmpeg with:

- 10 frames per second
- 360px output width, preserving the original aspect ratio
- Lanczos scaling and a generated 256-color palette
- Infinite looping
- Audio removed (GIF does not support audio)

GIFs and conversion logs are uploaded as the `preview-gifs` Actions artifact for 14 days. They are intentionally not committed to the repository, so running the workflow does not create binary diffs or trigger itself again.

### Failures

A failed preview does not stop the remaining conversions. The artifact includes a summary and individual FFmpeg logs, while the workflow is marked failed if any input could not be converted. This makes codec problems—such as a runner failing to decode the HEVC video `Purplepills.mov`—visible without losing successful outputs.

Only `previews/*.mov` files are processed. The `.tendies` archives in `downloads/` are not video inputs.

### Local testing

The same conversion pipeline requires FFmpeg locally. For one preview:

```sh
mkdir -p generated-gifs
ffmpeg -i "previews/Snoopy 2.mov" \
  -vf 'fps=10,scale=360:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=sierra2_4a' \
  -map 0:v:0 -an -loop 0 generated-gifs/'Snoopy 2.gif'
```

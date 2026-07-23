# BlotCanvas

BlotCanvas is a local-first browser application for preparing Western blot figures, source records, and preliminary quantification.

**Public beta:** <https://bonnginn.github.io/blotcanvas/?lang=en>

**English user guide:** <https://bonnginn.github.io/blotcanvas/manual-en.html>

> BlotCanvas is beta software under active validation. Features, workflows, and the project JSON format may change. Always retain independent copies of original images and important outputs.

## Main features

- Processes selected images locally in the browser without uploading experimental images to the BlotCanvas server
- Automatically groups ATTO LuminoGraph CL, Merge, and M files
- Manual image-role assignment for other imaging systems
- Creates a working Merge when signal and bright-field/marker images are acquired separately
- Supports TIFF, PNG, and JPEG input
- Per-acquisition rotation correction and crop-region adjustment
- Synchronized gel width and antibody-specific blot height
- Molecular-weight marker presets and custom marker registration
- Simple, repeated, hierarchical, and +/− lane-label layouts
- Automatic one-line, two-line, or rotated display for long lane labels
- High-resolution PNG, JPEG, TIFF, PDF, editable PDF, and SVG export
- Signal/Merge source records and resumable project JSON files
- Initial rectangular-ROI quantification using original 16-bit pixels, background correction, normalization, graphs, and CSV export

## Important limitations

The quantification workflow is an early rectangular-ROI implementation. Validate results against ImageJ or another established workflow before using measurements in a publication. Lane profiles, baseline selection, peak integration, and statistical analysis are planned.

## Browsers

The latest Google Chrome is recommended. Microsoft Edge is also supported. Safari behavior is being tested, especially for folder import and file saving.

## Data handling

Image import, adjustment, cropping, Figure creation, and quantification run in the browser. BlotCanvas does not upload or store experimental images on its server. The public site uses cookie-free Cloudflare Web Analytics for anonymous page-view statistics; images, project contents, and experimental labels are not included.

## Feedback

Use the bilingual “Report a problem or suggestion” form in the application. Do not include patient information, confidential data, unpublished images, or other information unnecessary for the report.

BlotCanvas is created and improved with OpenAI Codex as a development tool. The developer reviews submitted reports and may provide the report text to Codex to organize the problem, investigate possible causes, and prepare implementation options. Requests are not implemented automatically; the developer decides their necessity, scientific validity, priority, and impact on existing workflows.

## License

BlotCanvas is available under the [MIT License](./LICENSE). Copyright © Hironori Inaba.

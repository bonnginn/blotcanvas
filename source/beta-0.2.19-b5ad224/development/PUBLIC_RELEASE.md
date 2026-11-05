# BlotCanvas public release checklist

## Feedback form

Create a Google Forms or Microsoft Forms form, then set its public response URL as
`NEXT_PUBLIC_FEEDBACK_FORM_URL` when building the hosted app. Until a URL is set,
the in-app feedback button displays a “preparing” notice.

Recommended fields:

1. Report type: bug / usability / feature request / other
2. What the user was trying to do
3. What happened and what was expected
4. Browser and operating system
5. BlotCanvas project JSON attachment (optional, with a warning to remove sensitive data)
6. Screenshot attachment (optional, with the same warning)
7. Reply email (optional)

Do not require users to upload Western blot source images. State separately in
the form how Google or Microsoft stores form responses and attachments.

## Release checks

- Confirm the feedback form URL and its access permissions.
- Confirm that no analytics or image-upload endpoint has been added.
- Test install, offline reopening, TIFF import, SVG export, and project JSON restore.
- Test with a large real-world folder in the recommended browser.
- Publish a short privacy statement and supported-browser note with the release URL.

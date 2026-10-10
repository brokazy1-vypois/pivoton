-- Allow GLB uploads for Avaturn 3D avatars in post-attachments bucket
update storage.buckets
set allowed_mime_types = array(
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'model/gltf-binary',
  'application/octet-stream',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed'
)
where id = 'post-attachments';

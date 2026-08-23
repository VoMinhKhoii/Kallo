import { submitFeedbackSchema } from '@/lib/api/contracts/feedback';
import {
  authed,
  fromZod,
  type JsonSchema,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';

const TAGS = ['Support'];

/** A single-file multipart body — the shape both uploads on this API use. */
export const fileUploadBody = (description: string): JsonSchema => ({
  type: 'object',
  required: ['file'],
  properties: { file: { type: 'string', format: 'binary', description } },
});

/** In-app feedback, and the screenshot that can accompany it. */
export const SUPPORT_PATHS: Record<string, PathItem> = {
  '/api/v1/feedback': {
    post: authed({
      operationId: 'submitFeedback',
      summary: 'Send feedback or a bug report',
      description:
        'Files a report against the running app version. Optionally references a screenshot uploaded first via `uploadFeedbackScreenshot`.',
      tags: TAGS,
      body: fromZod(submitFeedbackSchema),
      ok: ref('Acknowledgement'),
      okStatus: '201',
    }),
  },

  '/api/v1/feedback/screenshot': {
    post: authed({
      operationId: 'uploadFeedbackScreenshot',
      summary: 'Upload a screenshot for a feedback report',
      description:
        'Multipart upload with a single `file` field. Returns the storage path to pass to `submitFeedback`. The request is size-checked from `Content-Length` before any bytes are buffered.',
      tags: TAGS,
      body: fileUploadBody('The screenshot image.'),
      bodyMedia: 'multipart/form-data',
      ok: ref('Acknowledgement'),
      okStatus: '201',
      okDescription: 'The stored path.',
    }),
  },
};

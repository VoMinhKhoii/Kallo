import { retryAccountDeletionJobs } from '@/lib/domain/account-deletion/jobs';

const result = await retryAccountDeletionJobs();
console.log(JSON.stringify(result));
if (result.failed > 0) process.exitCode = 1;

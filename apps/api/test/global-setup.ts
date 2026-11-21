import { execSync } from 'node:child_process';

export default function setup(): void {
  const url =
    process.env.DATABASE_URL ??
    'postgresql://bastiao:bastiao@localhost:5432/bastiao_test?schema=public';
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}

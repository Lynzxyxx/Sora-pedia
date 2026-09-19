import { createRoute } from '@/lib/route';
import { adminServicesDelete } from '@/lib/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = createRoute(adminServicesDelete);

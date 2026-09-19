import { createRoute } from '@/lib/route';
import { createTicket } from '@/lib/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = createRoute(createTicket);

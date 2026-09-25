import { POST as whatsappPostHandler, GET as whatsappGetHandler } from "@/app/api/whatsapp/webhook/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  return whatsappPostHandler(req);
}

export async function GET() {
  return whatsappGetHandler();
}

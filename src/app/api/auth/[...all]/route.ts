import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

/** همه endpointهای Better Auth: /api/auth/sign-in/email, /api/auth/get-session, ... */
export const { GET, POST } = toNextJsHandler(auth);

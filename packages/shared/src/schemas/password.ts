import { z } from "zod";
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from "../constants";

export const NewPasswordSchema = z.string().regex(PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE);

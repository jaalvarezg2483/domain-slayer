import { createContext, useContext } from "react";

/** Indica si el backend exige JWT (`JWT_SECRET` definido). */
export type AuthModeContextValue = {
  authRequired: boolean;
};

export const AuthModeContext = createContext<AuthModeContextValue>({ authRequired: true });

export function useAuthMode(): AuthModeContextValue {
  return useContext(AuthModeContext);
}

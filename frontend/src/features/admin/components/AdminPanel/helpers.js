import { jwtDecode } from "jwt-decode";

export function isTokenExpired(token) {
    try {
        const { exp } = jwtDecode(token);
        if (!exp) return true;
        return Date.now() >= exp * 1000;
    } catch {
        return true;
    }
}
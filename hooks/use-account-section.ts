import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import { getApiBaseUrl, getOAuthUrl } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { clearAllData } from "@/lib/storage";
import { showAlert } from "@/lib/alert";
import type { User } from "@/lib/_core/auth";

export function useAccountSection({
  user,
  onSignOut,
}: {
  user: User | null | undefined;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const { changePassword, deleteAccount, resendVerification } = useAuth({ autoFetch: false });

  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteTypedEmail, setDeleteTypedEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });
  const [resending, setResending] = useState(false);

  // Only offer providers the server can actually complete. Rendering the
  // buttons while unconfigured sent users to a dead endpoint.
  useEffect(() => {
    let active = true;
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return;
    fetch(`${baseUrl}/api/auth/oauth/providers`)
      .then((res) => (res.ok ? res.json() : { google: false, apple: false }))
      .then((data) => {
        if (!active) return;
        setOauthProviders({
          google: data.google === true,
          apple: data.apple === true,
        });
      })
      .catch(() => {
        if (active) setOauthProviders({ google: false, apple: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await resendVerification();
      showAlert("Verification email sent", "Check your inbox — we sent a new verification link.");
    } catch (e) {
      showAlert("Resend failed", e instanceof Error ? e.message : String(e));
    } finally {
      setResending(false);
    }
  };

  const handleChangePassword = async () => {
    setChangeError(null);
    if (!currentPw || !newPw || !confirmPw) {
      setChangeError("All fields are required");
      return;
    }
    if (newPw.length < 6) {
      setChangeError("New password must be at least 6 characters");
      return;
    }
    if (newPw !== confirmPw) {
      setChangeError("New passwords do not match");
      return;
    }
    setChanging(true);
    try {
      await changePassword(currentPw, newPw);
      setShowChangePw(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setChangeError(null);
      showAlert("Success", "Password changed successfully");
    } catch (e) {
      setChangeError(e instanceof Error ? e.message : String(e));
    } finally {
      setChanging(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      showAlert("Confirm required", 'Please type DELETE to confirm');
      return;
    }
    if ((deleteTypedEmail.trim().toLowerCase()) !== (user?.email ?? "").toLowerCase()) {
      showAlert("Email mismatch", "Typed email does not match your account email");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount("DELETE");
      await clearAllData();
      await onSignOut();
      setShowDelete(false);
      setDeleteStep(1);
      setDeleteConfirmText("");
      setDeleteTypedEmail("");
      router.replace("/");
    } catch (e) {
      showAlert("Delete failed", e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    try {
      const url = await getOAuthUrl(provider);
      if (!url) {
        showAlert("OAuth not configured", "Server not configured for social login.");
        return;
      }
      if (Platform.OS === "web") {
        window.location.href = url;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(url, "omnishop:/oauth/callback");
      if (result.type === "success" && result.url) {
        await Linking.openURL(result.url);
      }
    } catch (e) {
      showAlert("OAuth failed", e instanceof Error ? e.message : String(e));
    } finally {
      setOauthLoading(null);
    }
  };

  const openDelete = () => {
    setShowDelete(true);
    setDeleteStep(1);
    setDeleteConfirmText("");
    setDeleteTypedEmail("");
  };

  return {
    showChangePw,
    setShowChangePw,
    currentPw,
    setCurrentPw,
    newPw,
    setNewPw,
    confirmPw,
    setConfirmPw,
    changeError,
    setChangeError,
    changing,
    handleChangePassword,
    showDelete,
    setShowDelete,
    deleteConfirmText,
    setDeleteConfirmText,
    deleteTypedEmail,
    setDeleteTypedEmail,
    deleting,
    deleteStep,
    setDeleteStep,
    oauthLoading,
    oauthProviders,
    resending,
    handleResendVerification,
    handleDeleteAccount,
    handleOAuth,
    openDelete,
  };
}

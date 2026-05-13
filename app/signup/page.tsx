"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase-config";
import { authService } from "@/services/authService";
import LogoVerticalIcon from "@/components/icons/LogoVerticalIcon";
import { FirebaseError } from "@firebase/util";
import Link from "next/link";

interface SignUpFormData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface ValidationErrors {
  emailTaken?: boolean;
  usernameTaken?: boolean;
}

export default function SignUpPage() {
  const [formData, setFormData] = useState<SignUpFormData>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const router = useRouter();

  // Debounced validation functions
  const checkEmailAvailability = async (email: string) => {
    if (!email || email.length < 3) return;
    
    setIsCheckingEmail(true);
    try {
      const exists = await authService.checkEmailExists(email);
      setValidationErrors(prev => ({ ...prev, emailTaken: exists }));
    } catch (error) {
      console.error("Error checking email:", error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 2) return;
    
    setIsCheckingUsername(true);
    try {
      const exists = await authService.checkUsernameExists(username);
      setValidationErrors(prev => ({ ...prev, usernameTaken: exists }));
    } catch (error) {
      console.error("Error checking username:", error);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Debounce timers
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
      if (usernameTimeoutRef.current) {
        clearTimeout(usernameTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation
    if (!formData.firstName.trim()) {
      setError("First name is required");
      setIsLoading(false);
      return;
    }

    if (!formData.lastName.trim()) {
      setError("Last name is required");
      setIsLoading(false);
      return;
    }

    if (!formData.username.trim()) {
      setError("Username is required");
      setIsLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // Check if email or username is already taken
    const emailExists = await authService.checkEmailExists(formData.email);
    if (emailExists) {
      setError("An account with this email already exists");
      setIsLoading(false);
      return;
    }

    const usernameExists = await authService.checkUsernameExists(formData.username);
    if (usernameExists) {
      setError("This username is already taken");
      setIsLoading(false);
      return;
    }

    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Create user profile in Firestore
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      await authService.createUserProfile(userCredential.user.uid, {
        name: fullName,
        username: formData.username.trim(),
        email: formData.email,
        isAdmin: false, // New users are not admin by default
        roleAssignments: [], // No branch assignments by default
      });

      // Redirect to waiting room since user needs admin approval
      router.push("/waiting-room");
    } catch (error) {
      console.error("Sign up error:", error);

      // Handle specific Firebase auth errors
      let errorMessage = "Sign up failed. Please try again.";
      if (error instanceof FirebaseError && error.code) {
        switch (error.code) {
          case "auth/email-already-in-use":
            errorMessage = "An account with this email already exists.";
            // Update validation state to reflect this
            setValidationErrors(prev => ({ ...prev, emailTaken: true }));
            break;
          case "auth/invalid-email":
            errorMessage = "Invalid email address.";
            break;
          case "auth/weak-password":
            errorMessage = "Password is too weak. Please choose a stronger password.";
            break;
          case "auth/operation-not-allowed":
            errorMessage = "Email/password accounts are not enabled.";
            break;
          default:
            errorMessage = error.message || "Sign up failed. Please try again.";
        }
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof SignUpFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (error) setError("");
    
    // Debounced validation for email and username
    if (field === "email") {
      // Clear previous timeout
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
      // Clear previous validation error
      setValidationErrors(prev => ({ ...prev, emailTaken: undefined }));
      
      // Set new timeout for validation
      emailTimeoutRef.current = setTimeout(() => {
        checkEmailAvailability(value);
      }, 800); // 800ms delay
    }
    
    if (field === "username") {
      // Clear previous timeout
      if (usernameTimeoutRef.current) {
        clearTimeout(usernameTimeoutRef.current);
      }
      // Clear previous validation error
      setValidationErrors(prev => ({ ...prev, usernameTaken: undefined }));
      
      // Set new timeout for validation
      usernameTimeoutRef.current = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 800); // 800ms delay
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: "url('/cover.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-md">
        {/* Sign Up Form */}
        <div className="bg-white rounded-[12px] shadow-xl">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="w-full h-full mx-auto mb-4 flex items-center justify-center bg-[var(--accent)] py-6 shadow-md rounded-t-[12px]">
              <div className="w-[165px] h-[100px]">
                <LogoVerticalIcon />
              </div>
            </div>
          </div>
          <p className="text-center text-[16px] font-medium text-[var(--secondary)]">
            Create your account
          </p>
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* First Name Field */}
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange("firstName")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    placeholder="First name"
                    disabled={isLoading}
                    autoComplete="given-name"
                  />
                </div>

                {/* Last Name Field */}
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange("lastName")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    placeholder="Last name"
                    disabled={isLoading}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange("username")}
                    className={`w-full px-4 py-3 pr-10 border-2 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all ${
                      validationErrors.usernameTaken
                        ? "border-red-300 bg-red-50"
                        : formData.username && !isCheckingUsername && validationErrors.usernameTaken === false
                        ? "border-green-300 bg-green-50"
                        : "border-gray-200"
                    }`}
                    placeholder="Choose a username"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                  {/* Status Icon */}
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {isCheckingUsername ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : validationErrors.usernameTaken === true ? (
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : formData.username && validationErrors.usernameTaken === false ? (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : null}
                  </div>
                </div>
                {/* Validation Message */}
                {validationErrors.usernameTaken && (
                  <p className="mt-1 text-sm text-red-600">This username is already taken</p>
                )}
                {formData.username && !isCheckingUsername && validationErrors.usernameTaken === false && (
                  <p className="mt-1 text-sm text-green-600">Username is available</p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange("email")}
                    className={`w-full px-4 py-3 pr-10 border-2 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all ${
                      validationErrors.emailTaken
                        ? "border-red-300 bg-red-50"
                        : formData.email && !isCheckingEmail && validationErrors.emailTaken === false
                        ? "border-green-300 bg-green-50"
                        : "border-gray-200"
                    }`}
                    placeholder="Enter your email"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                  {/* Status Icon */}
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {isCheckingEmail ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : validationErrors.emailTaken === true ? (
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : formData.email && validationErrors.emailTaken === false ? (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : null}
                  </div>
                </div>
                {/* Validation Message */}
                {validationErrors.emailTaken && (
                  <p className="mt-1 text-sm text-red-600">This email is already registered</p>
                )}
                {formData.email && !isCheckingEmail && validationErrors.emailTaken === false && (
                  <p className="mt-1 text-sm text-green-600">Email is available</p>
                )}
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 gap-4">
                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange("password")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    placeholder="Create password (min. 6 characters)"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange("confirmPassword")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-[6px] text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    placeholder="Confirm your password"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  isLoading || 
                  validationErrors.emailTaken || 
                  validationErrors.usernameTaken || 
                  isCheckingEmail || 
                  isCheckingUsername
                }
                className={`w-full py-3 rounded-[6px] font-semibold transition-all shadow-lg ${
                  isLoading || 
                  validationErrors.emailTaken || 
                  validationErrors.usernameTaken || 
                  isCheckingEmail || 
                  isCheckingUsername
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white hover:scale-105 active:scale-95"
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Creating account...
                  </div>
                ) : (
                  "CREATE ACCOUNT"
                )}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-[var(--secondary)]">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-[var(--secondary)] opacity-50">
                FoodMood Point-of-Sales System v1.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
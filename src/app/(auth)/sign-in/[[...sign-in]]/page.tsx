import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <SignIn
      signUpUrl="/sign-up"
      forceRedirectUrl="/parent"
      appearance={{
        variables: {
          colorPrimary: '#2a9a93',
          colorBackground: '#ffffff',
          colorText: '#3a3322',
          borderRadius: '0.75rem',
        },
        elements: {
          card: 'shadow-md',
          formButtonPrimary:
            'bg-[#2a9a93] hover:bg-[#186e69] text-white rounded-full',
        },
      }}
    />
  );
}

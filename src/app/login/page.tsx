import { LoginForm } from '@/components/login-form';
import { isRegistrationEnabled } from '@/lib/config';
import { getAuthSettingsAction } from '@/app/actions';

export default async function LoginPage() {
    const enableRegistration = isRegistrationEnabled();
    const authSettings = await getAuthSettingsAction();

    return (
        <div className="flex min-h-screen items-center justify-center">
            <LoginForm enableRegistration={enableRegistration} authSettings={authSettings} />
        </div>
    );
}

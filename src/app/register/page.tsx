import { RegisterForm } from '@/components/register-form';
import { isRegistrationEnabled } from '@/lib/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
    if (!isRegistrationEnabled()) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Registration Disabled</CardTitle>
                        <CardDescription>
                            New account registration is currently disabled by the administrator.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/login" className="text-primary hover:underline">
                            Return to Login
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <RegisterForm />
        </div>
    );
}

import { getClients } from '@/lib/config';
import { ClientList } from '@/components/client-list';
import { NewClientDialog } from '@/components/new-client-dialog';
import { logoutAction } from '@/app/actions';
import { Button } from '@/components/ui/button';

export default async function Dashboard() {
  const clients = await getClients();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">OAuth Simulator</h1>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">
              Manage OAuth clients and simulate authorization flows.
            </p>
          </div>
          <div className="flex gap-4">
            <NewClientDialog />
            <form action={logoutAction}>
              <Button variant="outline">Logout</Button>
            </form>
          </div>
        </div>

        <ClientList clients={clients} />
      </div>
    </div>
  );
}

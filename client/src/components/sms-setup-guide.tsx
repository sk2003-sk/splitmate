import type { ReactNode } from 'react';
import { Apple, Smartphone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

function Screen({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[196px]">
      <div className="overflow-hidden rounded-[18px] border-[5px] border-zinc-800 bg-zinc-950 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.9)]">
        <div className="flex justify-center pb-1 pt-1.5">
          <span className="h-1 w-10 rounded-full bg-zinc-800" />
        </div>
        <div className="flex min-h-[150px] flex-col gap-1 px-2 pb-2">
          <p className="text-center text-[8px] font-semibold text-zinc-100">{title}</p>
          {children}
        </div>
      </div>
      <p className="mt-1 text-center text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}

function Row({
  children,
  highlight,
  className,
}: {
  children: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-1 text-[7px] leading-tight text-zinc-300',
        highlight && 'border-primary ring-2 ring-primary/60',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-[6px] text-zinc-500">{children}</span>;
}

function Toggle({ on, className }: { on?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'ml-auto inline-flex h-2.5 w-5 shrink-0 items-center rounded-full p-0.5',
        on ? 'bg-emerald-500' : 'bg-zinc-700',
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full bg-white', on ? 'translate-x-[10px]' : 'translate-x-0')}
      />
    </span>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 p-1.5 font-mono text-[6px] leading-[1.5] text-zinc-300">
      {children}
    </pre>
  );
}

function PhoneButton({ children, highlight }: { children: ReactNode; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md bg-primary py-1 text-center text-[7px] font-semibold text-primary-foreground',
        highlight && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-zinc-950',
      )}
    >
      {children}
    </div>
  );
}

function StepCard({
  n,
  title,
  screenTitle,
  body,
  screen,
  caption,
}: {
  n: number;
  title: string;
  screenTitle?: string;
  body: ReactNode;
  screen: ReactNode;
  caption: string;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {n}
        </span>
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <div className="mt-3 flex-1">
        <Screen title={screenTitle ?? title} caption={caption}>
          {screen}
        </Screen>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

const IOS_STEPS = (endpoint: string) => [
  {
    title: 'Open Automation',
    screenTitle: 'Shortcuts',
    caption: 'Automation → + → Message',
    body: (
      <>
        In <strong>Shortcuts</strong>, open the <strong>Automation</strong> tab, tap <strong>+</strong>,
        then choose <strong>Message</strong>.
      </>
    ),
    screen: (
      <>
        <Row>
          <span className="font-semibold text-zinc-100">Shortcuts</span>
          <span className="ml-auto flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground">
            +
          </span>
        </Row>
        <Muted>Automation</Muted>
        <Row><span className="text-zinc-500">Bluetooth</span></Row>
        <Row><span className="text-zinc-500">Time of Day</span></Row>
        <Row highlight>
          <span className="text-zinc-100">Message</span>
          <span className="ml-auto text-[6px] text-zinc-400">When I receive a message</span>
        </Row>
        <Row><span className="text-zinc-500">Wi-Fi</span></Row>
      </>
    ),
  },
  {
    title: 'Set the trigger',
    screenTitle: 'New Automation',
    caption: 'Any Sender · Message Contains',
    body: (
      <>
        Leave <strong>Sender</strong> on <strong>Any Sender</strong> — bank short codes like HDFCBK
        can&apos;t be added there. In <strong>Message Contains</strong> type a word every bank alert has,
        e.g. <code className="font-mono">debited</code>, <code className="font-mono">spent</code> or your
        bank name. Pick <strong>Run Immediately</strong> (newer iOS: switch{' '}
        <strong>Confirm Before Run</strong> off), then tap <strong>Next</strong>.
      </>
    ),
    screen: (
      <>
        <Muted>Message</Muted>
        <Row>
          <span className="text-zinc-100">Sender</span>
          <span className="ml-auto text-zinc-300">Any Sender</span>
        </Row>
        <Row highlight>
          <span className="font-semibold text-zinc-100">Message Contains</span>
          <span className="ml-auto rounded bg-zinc-800 px-1 font-mono text-[6px]">debited</span>
        </Row>
        <Row>
          <span className="text-zinc-100">Run Immediately</span>
          <span className="ml-auto text-emerald-400">✓</span>
        </Row>
        <Row>
          <span className="text-zinc-500">Run After Confirmation</span>
          <span className="ml-auto text-zinc-600">○</span>
        </Row>
        <PhoneButton>Next</PhoneButton>
      </>
    ),
  },
  {
    title: 'Grab the SMS text',
    screenTitle: 'New Automation',
    caption: 'Get Text from Input',
    body: (
      <>
        In the automation editor tap <strong>Add Action</strong> (or the search bar) and search{' '}
        <strong>Get Text from Input</strong>. Set its <strong>Input</strong> to{' '}
        <strong>Shortcut Input</strong> — that now holds the bank message text.
      </>
    ),
    screen: (
      <>
        <Row><Muted>Search Actions</Muted></Row>
        <Row highlight>
          <span className="font-semibold text-zinc-100">Get Text from Input</span>
          <span className="ml-auto text-[6px] text-zinc-400">Input: Shortcut Input</span>
        </Row>
        <Row><Muted>Get Contents of URL</Muted></Row>
        <Row><Muted>Show Notification</Muted></Row>
      </>
    ),
  },
  {
    title: 'Paste the endpoint',
    screenTitle: 'Get Contents of URL',
    caption: 'URL + Show More',
    body: (
      <>
        Add <strong>Get Contents of URL</strong> and paste your endpoint. At first you only see the URL
        field and a <strong>Show More</strong> button — Method, Headers and Request Body stay hidden until
        you open it.
      </>
    ),
    screen: (
      <>
        <Row>
          <span className="min-w-0 flex-1 truncate font-mono text-[6px] text-zinc-100">{endpoint}</span>
        </Row>
        <Row highlight>
          <span className="font-semibold text-zinc-100">Show More</span>
          <span className="ml-auto text-zinc-400">⌄</span>
        </Row>
        <Muted>Method · Headers · Body hidden</Muted>
      </>
    ),
  },
  {
    title: 'Show Method + Headers',
    screenTitle: 'Get Contents of URL',
    caption: 'Show More → POST + header',
    body: (
      <>
        Tap <strong>Show More</strong> (iPad/Mac: the action&apos;s arrow). Set <strong>Method</strong> to{' '}
        <strong>POST</strong>, then tap <strong>Headers → Add new header</strong> and enter{' '}
        <strong>Content-Type</strong> = <code className="font-mono">application/json</code>. If Headers
        isn&apos;t there, the JSON body in the next step still sends it — POST is the one you must set.
      </>
    ),
    screen: (
      <>
        <Row highlight>
          <span className="font-semibold text-zinc-100">Method</span>
          <span className="ml-auto font-mono">POST</span>
        </Row>
        <Row><span className="text-zinc-100">Headers</span><span className="ml-auto text-zinc-400">Add new header</span></Row>
        <Row>
          <span className="font-mono text-[6px] text-zinc-400">Content-Type</span>
          <span className="ml-auto font-mono text-[6px] text-zinc-200">application/json</span>
        </Row>
        <Row><Muted>Request Body: JSON</Muted></Row>
      </>
    ),
  },
  {
    title: 'Choose the JSON body',
    screenTitle: 'Request Body',
    caption: 'Request Body → JSON',
    body: (
      <>
        Under <strong>Show More</strong>, tap <strong>Request Body</strong> and choose{' '}
        <strong>JSON</strong>. The action now shows a small table with <strong>Key</strong> and{' '}
        <strong>Value</strong> columns and an <strong>Add new field</strong> row.
      </>
    ),
    screen: (
      <>
        <Row>
          <span className="font-semibold text-zinc-100">Request Body</span>
          <span className="ml-auto rounded bg-zinc-800 px-1 text-[6px] text-zinc-200">JSON</span>
        </Row>
        <Row>
          <span className="text-[6px] text-zinc-500">Key</span>
          <span className="ml-auto text-[6px] text-zinc-500">Value</span>
        </Row>
        <Row>
          <span className="text-[6px] text-zinc-600">Key</span>
          <span className="ml-auto text-[6px] text-zinc-600">Value</span>
        </Row>
        <Row highlight>
          <span className="text-zinc-100">+ Add new field</span>
        </Row>
      </>
    ),
  },
  {
    title: 'Add token + text',
    screenTitle: 'Request Body',
    caption: 'Key / Value + Text variable',
    body: (
      <>
        Tap <strong>Add new field</strong>: Key = <code className="font-mono">token</code>, Value = paste
        the long token from the box above (if you lost it, rotate the token first). Add another field: Key
        = <code className="font-mono">text</code>, tap its Value, then in the bar above the keyboard choose{' '}
        <strong>Select Variable → Get Text from Input</strong> (the <strong>Text</strong> chip). Don&apos;t
        add a sender field.
      </>
    ),
    screen: (
      <>
        <Row><span className="font-semibold text-zinc-100">Request Body</span><span className="ml-auto rounded bg-zinc-800 px-1 text-[6px] text-zinc-200">JSON</span></Row>
        <Row>
          <span className="font-mono text-[6px] text-zinc-400">token</span>
          <span className="ml-auto truncate font-mono text-[6px] text-zinc-200">paste your token</span>
        </Row>
        <Row highlight>
          <span className="font-mono text-[6px] text-zinc-400">text</span>
          <span className="ml-auto rounded bg-sky-500/20 px-1 font-mono text-[6px] text-sky-300">Text</span>
        </Row>
        <Row>
          <Muted>Select Variable</Muted>
          <span className="ml-auto text-[6px] text-sky-300">Get Text from Input</span>
        </Row>
      </>
    ),
  },
  {
    title: 'Save and test',
    screenTitle: 'Automation',
    caption: 'Automation runs on next SMS',
    body: (
      <>
        Save. The next bank alert appears in <strong>Payments</strong> with an{' '}
        <strong>Auto · SMS</strong> badge.
      </>
    ),
    screen: (
      <>
        <Row>
          <span className="font-semibold text-zinc-100">Bank alert → SplitMate</span>
          <Toggle on />
        </Row>
        <Muted>Runs immediately · no confirmation</Muted>
        <Row className="border-emerald-500/40 bg-emerald-500/10">
          <span className="text-emerald-400">✓</span>
          <span className="text-emerald-300">Payment added · Auto · SMS</span>
        </Row>
        <Row>
          <span className="font-semibold text-zinc-100">₹1,250 · HDFC Bank</span>
          <Muted>just now</Muted>
        </Row>
      </>
    ),
  },
];

const ANDROID_STEPS = (endpoint: string) => [
  {
    title: 'Install a forwarder',
    screenTitle: 'SMS Forwarder',
    caption: 'Any SMS webhook app',
    body: (
      <>
        Install an SMS-forwarding app that supports webhooks — for example <strong>SMS Forwarder</strong>,{' '}
        <strong>MacroDroid</strong> or <strong>Tasker</strong>.
      </>
    ),
    screen: (
      <>
        <Row><span className="font-semibold text-zinc-100">SMS Forwarder</span><Muted>rules</Muted></Row>
        <Row><span className="text-zinc-500">No rules yet</span></Row>
        <Row><span className="text-zinc-500">Settings</span></Row>
        <PhoneButton highlight>+ New rule</PhoneButton>
      </>
    ),
  },
  {
    title: 'Allow SMS access',
    screenTitle: 'Permission',
    caption: 'Permission prompt',
    body: (
      <>
        Grant SMS permission. The phone reads the alert; SplitMate only receives what the rule forwards.
      </>
    ),
    screen: (
      <>
        <Row><span className="text-zinc-100">Allow SMS Forwarder to read your messages?</span></Row>
        <Row><Muted>Needed to detect bank alerts</Muted></Row>
        <div className="mt-auto grid grid-cols-2 gap-1">
          <div className="rounded-md border border-zinc-700 py-1 text-center text-[7px] text-zinc-400">Deny</div>
          <div className="rounded-md bg-emerald-600 py-1 text-center text-[7px] font-semibold text-white ring-2 ring-emerald-400/50">
            Allow
          </div>
        </div>
      </>
    ),
  },
  {
    title: 'Match bank alerts',
    screenTitle: 'New rule',
    caption: 'Trigger: SMS received',
    body: (
      <>
        Create a rule for incoming SMS from your bank sender IDs (<code className="font-mono">HDFCBK</code>,{' '}
        <code className="font-mono">ICICIB</code>…), with action <strong>Webhook / HTTP POST</strong>.
      </>
    ),
    screen: (
      <>
        <Row><span className="font-semibold text-zinc-100">New rule</span></Row>
        <Row><span className="text-zinc-100">When</span><span className="ml-auto">SMS received</span></Row>
        <Row highlight>
          <span className="text-zinc-100">From</span>
          <span className="ml-auto font-mono text-[6px]">HDFCBK, ICICIB, SBIINB…</span>
        </Row>
        <Row><span className="text-zinc-100">Then</span><span className="ml-auto">Webhook</span></Row>
      </>
    ),
  },
  {
    title: 'Webhook details',
    screenTitle: 'Webhook',
    caption: 'URL + JSON body',
    body: (
      <>
        Point the webhook at your endpoint with Method <strong>POST</strong>, header{' '}
        <code className="font-mono">Content-Type: application/json</code>, and this body:
      </>
    ),
    screen: (
      <>
        <Row highlight>
          <span className="min-w-0 flex-1 truncate font-mono text-[6px] text-zinc-100">{endpoint}</span>
        </Row>
        <Row><span className="text-zinc-100">Method</span><span className="ml-auto font-mono">POST</span></Row>
        <Code>{`{
  "token": "your token",
  "text": "{{message}}",
  "sender": "{{from}}"
}`}</Code>
      </>
    ),
  },
  {
    title: 'Enable and test',
    screenTitle: 'Rules',
    caption: 'Rule toggled on',
    body: (
      <>
        Turn the rule on. Each run appears under <strong>Recent SMS captures</strong> below, and parsed
        bills land in Payments.
      </>
    ),
    screen: (
      <>
        <Row>
          <span className="font-semibold text-zinc-100">Bank alert → SplitMate</span>
          <Toggle on />
        </Row>
        <Muted>Webhook · POST · JSON</Muted>
        <Row className="border-emerald-500/40 bg-emerald-500/10">
          <span className="text-emerald-400">✓</span>
          <span className="text-emerald-300">Last run: success</span>
        </Row>
        <Row>
          <span className="font-semibold text-zinc-100">₹1,250 · HDFC Bank</span>
          <Muted>just now</Muted>
        </Row>
      </>
    ),
  },
];

export function SmsSetupGuide({ endpoint }: { endpoint: string }) {
  return (
    <Tabs defaultValue="iphone">
      <TabsList className="h-auto w-full justify-start sm:w-auto">
        <TabsTrigger value="iphone" className="flex-1 sm:flex-none">
          <Apple className="h-4 w-4" /> iPhone
        </TabsTrigger>
        <TabsTrigger value="android" className="flex-1 sm:flex-none">
          <Smartphone className="h-4 w-4" /> Android
        </TabsTrigger>
      </TabsList>

      <TabsContent value="iphone">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {IOS_STEPS(endpoint).map((step, index) => (
            <StepCard key={step.title} n={index + 1} {...step} />
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <p className="text-xs font-semibold">Not seeing these fields?</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
            <li>
              Only the URL and nothing else? Tap <strong>Show More</strong> underneath it — Method,
              Headers and Request Body are collapsed by default. On iPad/Mac it is the arrow on the
              action.
            </li>
            <li>
              <strong>Headers</strong> missing? It lives inside Show More, next to Method. Tapping{' '}
              <strong>Add new header</strong> creates the Header/Value pair.
            </li>
            <li>
              Can&apos;t find the actions at all? In the automation editor tap <strong>Add Action</strong>,
              then search for <strong>Get Text from Input</strong> and <strong>Get Contents of URL</strong>.
            </li>
            <li>
              No <strong>Sender</strong> field to fill? Expected — a Message automation only passes the
              text, and SplitMate reads the bank from the message.
            </li>
            <li>
              Token box empty? A token is only displayed once — use <strong>Rotate token</strong> above,
              copy the new one, and update the Shortcut value.
            </li>
          </ul>
        </div>
      </TabsContent>

      <TabsContent value="android">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ANDROID_STEPS(endpoint).map((step, index) => (
            <StepCard key={step.title} n={index + 1} {...step} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

import { ExternalLink } from 'lucide-react';

interface Props {
    signature: string;
    label?: string;
    failed?: boolean;
}

const EXPLORER_BASE = 'https://explorer.solana.com/tx';

export function getExplorerUrl(signature: string): string {
    return `${EXPLORER_BASE}/${signature}?cluster=devnet`;
}

export default function TxLink({ signature, label, failed }: Props) {
    const short = `${signature.slice(0, 4)}...${signature.slice(-4)}`;

    return (
        <a
            href={getExplorerUrl(signature)}
            target="_blank"
            rel="noopener noreferrer"
            className={`tx-link ${failed ? 'tx-link-failed' : 'tx-link-success'}`}
        >
            <ExternalLink />
            <span className="tx-link-label">{label || (failed ? 'Failed Tx' : 'View Tx')}</span>
            <span className="tx-link-sig">{short}</span>
        </a>
    );
}

import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import TxLink from './TxLink';

export interface TxNotification {
    id: number;
    title: string;
    signature?: string;
    success: boolean;
}

let idCounter = 0;

export function useTxToast() {
    const [toasts, setToasts] = useState<TxNotification[]>([]);

    const addToast = useCallback((title: string, signature?: string, success = true) => {
        const id = ++idCounter;
        setToasts(prev => [...prev, { id, title, signature, success }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 8000);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
}

interface Props {
    toasts: TxNotification[];
    onRemove: (id: number) => void;
}

export default function TxToast({ toasts, onRemove }: Props) {
    if (toasts.length === 0) return null;

    return (
        <div className="tx-toast-container">
            {toasts.map(t => (
                <div className="tx-toast" key={t.id}>
                    {t.success ? (
                        <CheckCircle2 className="tx-toast-icon success" />
                    ) : (
                        <XCircle className="tx-toast-icon error" />
                    )}
                    <div className="tx-toast-body">
                        <div className="tx-toast-title">{t.title}</div>
                        {t.signature && (
                            <TxLink signature={t.signature} failed={!t.success} />
                        )}
                    </div>
                    <button className="tx-toast-close" onClick={() => onRemove(t.id)}>
                        <X />
                    </button>
                </div>
            ))}
        </div>
    );
}

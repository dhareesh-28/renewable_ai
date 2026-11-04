import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SIDE_SHEET_VARIANTS } from '../../motion';

interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SideSheet: React.FC<SideSheetProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                variants={SIDE_SHEET_VARIANTS}
                initial="closed"
                animate="open"
                exit="closed"
                className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-raised border-l border-hairline p-6 md:p-8 flex flex-col justify-between shadow-xl focus:outline-none overflow-y-auto"
              >
                <div>
                  <div className="flex items-start justify-between pb-6 border-b border-hairline">
                    <div>
                      <Dialog.Title className="text-h3 font-serif font-light text-ink">
                        {title}
                      </Dialog.Title>
                      {description && (
                        <Dialog.Description className="text-caption text-muted mt-1">
                          {description}
                        </Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close asChild>
                      <button
                        className="p-1.5 text-muted hover:text-ink rounded-full hover:bg-surface transition-colors cursor-pointer"
                        aria-label="Close"
                      >
                        <X size={18} />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div className="py-6 space-y-6">{children}</div>
                </div>

                <div className="pt-6 border-t border-hairline flex items-center justify-end gap-3">
                  <Dialog.Close asChild>
                    <button className="px-5 py-2 text-ui text-muted hover:text-ink cursor-pointer transition-colors">
                      Cancel
                    </button>
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};


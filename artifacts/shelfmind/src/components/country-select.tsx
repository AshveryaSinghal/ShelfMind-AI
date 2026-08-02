'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { COUNTRIES } from '@/lib/countries';

interface CountrySelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Searchable country picker built on Popover + Command instead of the native
 * Radix Select.
 *
 * Why: with 190+ countries, the plain Select's dropdown could overflow the
 * viewport on short/mobile screens, blocking items near the bottom and
 * occasionally leaving the page unable to scroll after close. Command's list
 * has its own bounded, internally-scrollable viewport and built-in
 * type-to-filter, so the picker never depends on the surrounding page's
 * scroll state.
 */
export function CountrySelect({
  id,
  value,
  onValueChange,
  placeholder = 'Select your country',
  disabled,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false);
  const selected = COUNTRIES.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 pl-9 text-sm font-normal shadow-sm hover:bg-transparent',
            !selected && 'text-muted-foreground',
          )}
        >
          <Globe className="absolute left-3 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <Command loop>
          <CommandInput placeholder="Search countries..." />
          <CommandList className="max-h-[min(320px,60vh)]">
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={c.name}
                  onSelect={() => {
                    onValueChange(c.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      c.code === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

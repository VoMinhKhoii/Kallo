'use client';

import { useFormContext } from 'react-hook-form';
import { OptionStrip } from '@/components/settings/option-strip';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import type { ProfileFormValues } from './index';

export function Cooking() {
  const form = useFormContext<ProfileFormValues>();

  return (
    <div className="space-y-6">
      {/* Oil usage */}
      <FormField
        control={form.control}
        name="oilUsage"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              How would you describe your typical cooked dishes?
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'minimal',
                    label: 'Light',
                    hint: 'Dry, clean taste. Dish looks matte.',
                  },
                  {
                    value: 'normal',
                    label: 'Moderate',
                    hint: 'Light coating. Slight sheen on food.',
                  },
                  {
                    value: 'heavy',
                    label: 'Rich',
                    hint: 'Visibly oily. Sauce pools slightly.',
                  },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Rice per meal */}
      <FormField
        control={form.control}
        name="defaultRicePortion"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              How much rice per meal?
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  { value: 'small', label: 'Light', hint: '~1 small bowl' },
                  { value: 'medium', label: 'Normal', hint: '~1–1.5 bowls' },
                  { value: 'large', label: 'Heavy', hint: '~2+ bowls' },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Sugar in braised */}
      <FormField
        control={form.control}
        name="sugarBraised"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              Sugar in braised dishes
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Protein portion */}
      <FormField
        control={form.control}
        name="defaultProteinPortion"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              How much protein (meat, fish, eggs) per meal?
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'small',
                    label: 'Small',
                    hint: 'Smaller than your palm, e.g. ~2-3 eggs',
                  },
                  {
                    value: 'medium',
                    label: 'Medium',
                    hint: 'About palm-sized',
                  },
                  {
                    value: 'large',
                    label: 'Large',
                    hint: 'Bigger than your palm, e.g. a chicken thigh or more',
                  },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Broth consumption */}
      <FormField
        control={form.control}
        name="brothConsumption"
        render={({ field }) => (
          <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
            <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
              When there&rsquo;s soup, how much broth do you usually drink?
            </FormLabel>
            <FormControl>
              <OptionStrip
                options={[
                  {
                    value: 'leave_it',
                    label: 'Leave it',
                    hint: 'Eat the solids, skip most broth',
                  },
                  {
                    value: 'some',
                    label: 'Some',
                    hint: 'Drink about half the bowl',
                  },
                  {
                    value: 'finish_it',
                    label: 'Finish it',
                    hint: 'Drink all or most of the broth',
                  },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

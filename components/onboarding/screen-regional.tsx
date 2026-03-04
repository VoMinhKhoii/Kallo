'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RegionalProfile } from '@/lib/onboarding/types';

interface ScreenRegionalProps {
  defaultValues: {
    regionalProfile?: RegionalProfile | null;
  };
  onChange: (data: {
    regionalProfile: RegionalProfile;
  }) => void;
}

const REGION_CARDS: {
  value: RegionalProfile;
  title: string;
  description: string;
}[] = [
  {
    value: 'mien_bac',
    title: 'Miền Bắc',
    description:
      'Thanh đạm, cân bằng. Ít dầu mỡ, ít ngọt — AI mặc định nêm nếm nhẹ nhàng, giữ nguyên vị tự nhiên của nguyên liệu.',
  },
  {
    value: 'mien_trung',
    title: 'Miền Trung',
    description:
      'Đậm đà, tròn vị. Gia vị phong phú, mắm đặc trưng — AI mặc định đậm hơn về muối và gia vị, khẩu phần cô đọng và tập trung hơn.',
  },
  {
    value: 'mien_nam',
    title: 'Miền Nam',
    description:
      'Ngọt dịu, phong phú. Vị ngọt nhẹ xuất hiện trong hầu hết các món — AI tự động cộng thêm lượng đường nhỏ cho món kho và xào.',
  },
  {
    value: 'mien_tay',
    title: 'Miền Tây',
    description:
      'Béo ngậy, ngọt sâu. Nước cốt dừa và đường là linh hồn của bếp miền Tây — AI mặc định lượng chất béo và carb cao hơn cho các món kho, canh, xào.',
  },
];

export function ScreenRegional({
  defaultValues,
  onChange,
}: ScreenRegionalProps) {
  const [selected, setSelected] =
    useState<RegionalProfile | null>(
      defaultValues.regionalProfile ?? null,
    );

  // Report on mount if resuming with pre-selected value
  useEffect(() => {
    if (selected) {
      onChange({ regionalProfile: selected });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (value: RegionalProfile) => {
    setSelected(value);
    onChange({ regionalProfile: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">
          Vùng miền ẩm thực
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Chọn vùng miền để AI hiểu thói quen nấu ăn của
          bạn
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {REGION_CARDS.map((region) => (
          <Card
            key={region.value}
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              selected === region.value &&
                'ring-2 ring-primary border-primary',
            )}
            onClick={() => handleSelect(region.value)}
          >
            <CardHeader>
              <CardTitle>{region.title}</CardTitle>
              <CardDescription>
                {region.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

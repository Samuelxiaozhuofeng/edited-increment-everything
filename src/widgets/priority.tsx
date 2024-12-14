import {
  renderWidget,
  usePlugin,
  useRunAsync,
  useTracker,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import React from 'react';
import { allIncrementalRemKey, powerupCode, prioritySlotCode, nextRepDateSlotCode } from '../lib/consts';
import { getIncrementalRemInfo } from '../lib/incremental_rem';
import { IncrementalRem } from '../lib/types';
import { calculateReviewDaysFromPriority } from '../lib/scheduler';
import { getDailyDocReferenceForDate } from '../lib/date';

interface PriorityButtonProps {
  label: string;
  value: number;
  onClick: (value: number) => void;
  description: string;
}

const PriorityButton: React.FC<PriorityButtonProps> = ({ label, value, onClick, description }) => {
  const days = calculateReviewDaysFromPriority(value);
  return (
    <button
      className="flex flex-col items-center justify-center p-4 m-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      onClick={() => onClick(value)}
    >
      <div className="text-lg font-bold">{label}</div>
      <div className="text-sm text-gray-500">{description}</div>
      <div className="text-xs text-gray-400">预计复习时间：{Math.round(days * 10) / 10} 天后</div>
    </button>
  );
};

export function Priority() {
  const plugin = usePlugin();
  const ctx = useRunAsync(async () => {
    return await plugin.widget.getWidgetContext<WidgetLocation.Popup>();
  }, []);

  const prioritizedRem = useTracker(
    async (rp) => {
      const rem = await rp.rem.findOne(ctx?.contextData?.remId);
      if (!rem) {
        return null;
      }
      return { rem };
    },
    [ctx?.contextData?.remId]
  );

  if (!prioritizedRem) {
    return null;
  }

  const { rem } = prioritizedRem;

  const handlePrioritySet = async (value: number) => {
    const parsed = IncrementalRem.shape.priority.safeParse(value);
    if (!parsed.success) {
      return;
    }

    // 设置优先级
    await rem?.setPowerupProperty(powerupCode, prioritySlotCode, [parsed.data.toString()]);

    // 根据优先级计算初始复习时间
    const initialDays = calculateReviewDaysFromPriority(value);
    const initialIntervalInMs = initialDays * 24 * 60 * 60 * 1000;
    const nextRepDate = new Date(Date.now() + initialIntervalInMs);
    
    // 设置下次复习日期
    const dateRef = await getDailyDocReferenceForDate(plugin, nextRepDate);
    if (!dateRef) {
      return;
    }
    await rem?.setPowerupProperty(powerupCode, nextRepDateSlotCode, dateRef);

    // update allIncrementalRem in storage
    const newIncRem = await getIncrementalRemInfo(plugin, rem);
    if (!newIncRem) {
      return;
    }

    const allIncrementalRem: IncrementalRem[] =
      (await plugin.storage.getSession(allIncrementalRemKey)) || [];
    const updatedAllRem = allIncrementalRem
      .filter((x) => x.remId !== newIncRem.remId)
      .concat(newIncRem);
    await plugin.storage.setSession(allIncrementalRemKey, updatedAllRem);

    // 关闭弹窗
    await plugin.widget.closePopup();
  };

  return (
    <div className="flex flex-col p-4 gap-4 priority-popup">
      <div className="text-2xl font-bold mb-4">设置优先级</div>
      <PriorityButton
        label="贼重要"
        value={0}
        onClick={handlePrioritySet}
        description="1-3天内复习"
      />
      <PriorityButton
        label="重要"
        value={33}
        onClick={handlePrioritySet}
        description="3-6天内复习"
      />
      <PriorityButton
        label="不重要"
        value={66}
        onClick={handlePrioritySet}
        description="6-9天内复习"
      />
    </div>
  );
}

renderWidget(Priority);

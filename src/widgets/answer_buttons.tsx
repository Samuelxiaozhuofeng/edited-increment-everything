import {
  renderWidget,
  RNPlugin,
  usePlugin,
  useRunAsync,
  useTracker,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import { NextRepTime } from '../components/NextRepTime';
import { allIncrementalRemKey, powerupCode } from '../lib/consts';
import { getIncrementalRemInfo, handleHextRepetitionClick } from '../lib/incremental_rem';
import { getNextSpacingDateForRem, updateSRSDataForRem } from '../lib/scheduler';
import { IncrementalRem } from '../lib/types';
import dayjs from 'dayjs';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

function Button(props: ButtonProps) {
  return (
    <button
      className={
        'bg-blue-50 hover:bg-blue-70 text-white font-bold py-2 px-4 rounded ' + props.className
      }
      style={{
        height: '45px',
      }}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function AnswerButtons() {
  const plugin = usePlugin();
  const ctx = useTracker(
    async (rp) => await rp.widget.getWidgetContext<WidgetLocation.FlashcardAnswerButtons>(),
    []
  );
  const incRem = useTracker(
    async (rp) => {
      const rem = await rp.rem.findOne(ctx?.remId);
      return rem ? await getIncrementalRemInfo(plugin, rem) : undefined;
    },
    [ctx?.remId]
  );

  // 添加自定义间隔处理函数
  const handleCustomInterval = async (days: number) => {
    if (!incRem) return;
    const rem = await plugin.rem.findOne(incRem.remId);
    if (!rem) return;

    // 计算新的复习日期
    const newNextRepDate = Date.now() + days * 24 * 60 * 60 * 1000;
    
    // 更新复习历史
    const newHistory = [
      ...(incRem.history || []),
      {
        date: Date.now(),
        scheduled: incRem.nextRepDate,
      },
    ];

    // 更新存储中的数据
    const oldAllRem: IncrementalRem[] = 
      (await plugin.storage.getSession(allIncrementalRemKey)) || [];
    const updatedAllRem = oldAllRem
      .filter((r) => r.remId !== incRem.remId)
      .concat({
        ...incRem,
        nextRepDate: newNextRepDate,
        history: newHistory,
      });
    await plugin.storage.setSession(allIncrementalRemKey, updatedAllRem);

    // 更新卡片数据
    await updateSRSDataForRem(plugin, incRem.remId, newNextRepDate, newHistory);
    
    // 移动到下一张卡片
    await plugin.queue.removeCurrentCardFromQueue();
  };

  return (
    <div className="flex flex-col gap-4 incremental-everything-answer-buttons">
      <div className="flex flex-row justify-center items-center gap-4">
        <Button
          className="interval-button"
          onClick={() => handleCustomInterval(2)}
        >
          <div className="flex flex-col items-center justify-center">
            <div>2天</div>
            <div className="text-xs">{dayjs().add(2, 'day').format('MM/DD')}</div>
          </div>
        </Button>
        <Button
          className="interval-button"
          onClick={() => handleCustomInterval(4)}
        >
          <div className="flex flex-col items-center justify-center">
            <div>4天</div>
            <div className="text-xs">{dayjs().add(4, 'day').format('MM/DD')}</div>
          </div>
        </Button>
        <Button
          className="interval-button"
          onClick={() => handleCustomInterval(7)}
        >
          <div className="flex flex-col items-center justify-center">
            <div>7天</div>
            <div className="text-xs">{dayjs().add(7, 'day').format('MM/DD')}</div>
          </div>
        </Button>
        <Button
          className="interval-button"
          onClick={() => handleCustomInterval(14)}
        >
          <div className="flex flex-col items-center justify-center">
            <div>14天</div>
            <div className="text-xs">{dayjs().add(14, 'day').format('MM/DD')}</div>
          </div>
        </Button>
      </div>

      <div className="flex flex-row justify-center items-center gap-6">
        <Button
          className="incremental-everthing-done-button"
          onClick={async () => {
            const rem = await plugin.rem.findOne(incRem?.remId);
            if (!rem) {
              return;
            }
            const updatedAllRem: IncrementalRem[] = (
              ((await plugin.storage.getSession(allIncrementalRemKey)) || []) as IncrementalRem[]
            ).filter((r) => r.remId !== rem._id);
            await plugin.storage.setSession(allIncrementalRemKey, updatedAllRem);
            await plugin.queue.removeCurrentCardFromQueue(true);
            await rem.removePowerup(powerupCode);
          }}
        >
          <div className="flex flex-col items-center justify-center">
            <div>Done</div>
            <div className="text-xs">Untag this Rem</div>
          </div>
        </Button>
      </div>
    </div>
  );
}

renderWidget(AnswerButtons);

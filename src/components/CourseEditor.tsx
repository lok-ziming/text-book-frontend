import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray, useWatch, FormProvider, useFormContext } from 'react-hook-form';
import { CourseData, Chapter, Section } from '../types';

// ---------------------------------------------------------
// 1. 左侧：递归树组件 (只负责导航和展示结构)
// ---------------------------------------------------------
interface SidebarTreeProps {
  control: any;
  onSelect: (path: string, type: 'course' | 'chapter' | 'section') => void;
  activePath: string | null;
  onAddSection: (chapterIndex: number) => void;
  onAddChapter: () => void;
  onMoveSection: (sourceChapterIndex: number, sourceSectionIndex: number, targetChapterIndex: number, targetSectionIndex: number) => void;
}

const SidebarTree: React.FC<SidebarTreeProps> = ({ control, onSelect, activePath, onAddSection, onAddChapter, onMoveSection }) => {
  const chapters = useWatch({ control, name: "chapters" });
  const title = useWatch({ control, name: "title" });
  const [draggedSection, setDraggedSection] = useState<{ chapterIndex: number; sectionIndex: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ chapterIndex: number; sectionIndex: number } | null>(null);

  // 计算最近的插入位置
  const calculateClosestInsertPosition = useCallback((mouseY: number, container: HTMLElement): number => {
    const containerRect = container.getBoundingClientRect();
    const sectionElements = Array.from(container.children).filter(
      child => child.classList.contains('section-item')
    ) as HTMLElement[];

    // 如果没有节，插入到索引0
    if (sectionElements.length === 0) {
      return 0;
    }

    let closestIndex = 0;
    let minDistance = Math.abs(mouseY - containerRect.top);

    // 遍历所有节，计算到每个插入点的距离
    sectionElements.forEach((element, idx) => {
      const rect = element.getBoundingClientRect();

      // 节之前的插入点
      const distanceToTop = Math.abs(mouseY - rect.top);
      if (distanceToTop < minDistance) {
        minDistance = distanceToTop;
        closestIndex = idx;
      }

      // 最后一个节之后的插入点
      if (idx === sectionElements.length - 1) {
        const distanceToBottom = Math.abs(mouseY - rect.bottom);
        if (distanceToBottom < minDistance) {
          closestIndex = idx + 1;
        }
      }
    });

    return closestIndex;
  }, []);

  return (
    <div className="w-80 border-r border-gray-300 p-4 bg-gray-50 overflow-y-auto h-full">
      <h3 className="text-lg font-semibold mb-4">课程大纲</h3>

      {/* 课程根节点 */}
      <div className="flex items-center gap-2 mb-2">
        <div
          onClick={() => onSelect('root', 'course')}
          className={`flex-1 p-3 cursor-pointer rounded ${activePath === 'root'
            ? 'bg-blue-500 text-white'
            : 'bg-blue-100 hover:bg-blue-200'
            }`}
        >
          📚 <strong>{title || '未命名课程'}</strong>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddChapter();
          }}
          className="px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
          title="添加章"
        >
          +
        </button>
      </div>

      {/* 章节点 */}
      {chapters?.map((chapter: Chapter, cIdx: number) => (
        <div key={chapter.id || cIdx} className="mb-3">
          <div className="flex items-center gap-2">
            <div
              onClick={() => onSelect(`chapters.${cIdx}`, 'chapter')}
              className={`flex-1 p-2 cursor-pointer rounded mb-1 ${activePath === `chapters.${cIdx}`
                ? 'bg-indigo-500 text-white'
                : 'bg-indigo-100 hover:bg-indigo-200'
                }`}
            >
              📂 <strong>{chapter.title || `第${cIdx + 1}章`}</strong>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddSection(cIdx);
              }}
              className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              title="添加节"
            >
              +
            </button>
          </div>

          {/* 节节点 (缩进) */}
          <div
            className="pl-6 mt-1 min-h-[40px]"
            onDragOver={(e) => {
              if (!draggedSection) return;
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';

              const closestIndex = calculateClosestInsertPosition(e.clientY, e.currentTarget);

              // 只在目标位置真正改变时更新状态
              if (dragOverTarget?.chapterIndex !== cIdx || dragOverTarget?.sectionIndex !== closestIndex) {
                setDragOverTarget({ chapterIndex: cIdx, sectionIndex: closestIndex });
              }
            }}
            onDragLeave={(e) => {
              // 检查是否真正离开了容器
              const relatedTarget = e.relatedTarget as HTMLElement;
              if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                setDragOverTarget(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const data = e.dataTransfer.getData('text/plain');
              if (data && draggedSection && dragOverTarget) {
                const [sourceChapterIndex, sourceSectionIndex] = data.split('-').map(Number);
                const targetIndex = dragOverTarget.sectionIndex;

                // 只有当位置真正改变时才移动
                if (sourceChapterIndex !== dragOverTarget.chapterIndex || sourceSectionIndex !== targetIndex) {
                  onMoveSection(sourceChapterIndex, sourceSectionIndex, dragOverTarget.chapterIndex, targetIndex);
                }
              }

              setDraggedSection(null);
              setDragOverTarget(null);
            }}
          >
            {/* 拖拽放置指示器 - 只在空章时显示 */}
            {dragOverTarget?.chapterIndex === cIdx &&
              dragOverTarget.sectionIndex === 0 &&
              (!chapter.sections || chapter.sections.length === 0) && (
                <div className="h-1 bg-blue-500 rounded mb-1" />
              )}

            {chapter.sections?.map((section: Section, sIdx: number) => {
              // 计算全局节序号
              let globalSectionIndex = 0;
              for (let i = 0; i < cIdx; i++) {
                globalSectionIndex += (chapters?.[i]?.sections?.length || 0);
              }
              globalSectionIndex += sIdx;

              const isDragging = draggedSection?.chapterIndex === cIdx && draggedSection?.sectionIndex === sIdx;

              return (
                <React.Fragment key={section.id || sIdx}>
                  {/* 拖拽放置指示器 - 在节之前 */}
                  {dragOverTarget?.chapterIndex === cIdx &&
                    dragOverTarget.sectionIndex === sIdx &&
                    !(draggedSection?.chapterIndex === cIdx && draggedSection?.sectionIndex === sIdx) && (
                      <div className="h-1 bg-blue-500 rounded mb-1" />
                    )}
                  <div
                    draggable
                    className={`section-item p-2 cursor-move rounded mb-1 border-l-2 border-gray-300 transition-all ${isDragging
                      ? 'opacity-50 bg-gray-200'
                      : activePath === `chapters.${cIdx}.sections.${sIdx}`
                        ? 'bg-green-500 text-white border-green-600'
                        : 'bg-green-50 hover:bg-green-100'
                      }`}
                    onDragStart={(e) => {
                      setDraggedSection({ chapterIndex: cIdx, sectionIndex: sIdx });
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', `${cIdx}-${sIdx}`);
                    }}
                    onDragEnd={() => {
                      // 清理所有拖动状态
                      setDraggedSection(null);
                      setDragOverTarget(null);
                    }}
                    onClick={() => onSelect(`chapters.${cIdx}.sections.${sIdx}`, 'section')}
                  >
                    🎥 {section.title || `第${globalSectionIndex + 1}节`}
                  </div>
                </React.Fragment>
              );
            })}
            {/* 拖拽放置指示器 - 在章的最后一个节之后（排除空章） */}
            {dragOverTarget?.chapterIndex === cIdx &&
              dragOverTarget.sectionIndex === (chapter.sections?.length || 0) &&
              chapter.sections && chapter.sections.length > 0 && (
                <div className="h-1 bg-blue-500 rounded mb-1" />
              )}
          </div>
        </div>
      ))}
      <div className="text-gray-500 text-xs mt-4">点击节点在右侧编辑属性</div>
    </div>
  );
};

// ---------------------------------------------------------
// 2. 右侧：属性编辑器 (根据节点类型渲染不同表单)
// ---------------------------------------------------------
interface PropertyEditorProps {
  activePath: string | null;
  activeType: 'course' | 'chapter' | 'section' | null;
  onDelete?: (path: string, type: 'chapter' | 'section') => void;
}

const PropertyEditor: React.FC<PropertyEditorProps> = ({ activePath, activeType, onDelete }) => {
  const { register, control } = useFormContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 获取所有章节用于计算索引
  const chapters = useWatch({ control, name: 'chapters' });

  // 计算当前章或节的索引
  const getChapterIndex = (path: string | null): number | null => {
    if (!path) return null;
    const match = path.match(/chapters\.(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  const getSectionIndex = (path: string | null): { chapterIndex: number; sectionIndex: number } | null => {
    if (!path) return null;
    const match = path.match(/chapters\.(\d+)\.sections\.(\d+)/);
    if (!match) return null;
    return {
      chapterIndex: parseInt(match[1], 10),
      sectionIndex: parseInt(match[2], 10)
    };
  };

  // 获取当前section的order值用于显示
  // 始终调用useWatch，使用条件路径或安全的默认路径（使用chapters作为后备，因为它总是存在）
  const sectionOrderWatchPath = (activePath && activeType === 'section'
    ? `${activePath}.order`
    : 'chapters') as any;
  const sectionOrderValue = useWatch({
    control,
    name: sectionOrderWatchPath,
    defaultValue: null
  });

  // 获取当前章的order值
  const chapterOrderWatchPath = (activePath && activeType === 'chapter'
    ? `${activePath}.order`
    : 'chapters') as any;
  const chapterOrderValue = useWatch({
    control,
    name: chapterOrderWatchPath,
    defaultValue: null
  });

  // 获取当前节点标题用于确认对话框和显示
  const titleWatchPath = (activePath === 'root'
    ? 'title'
    : (activePath ? `${activePath}.title` : 'title')) as any;
  const currentTitle = useWatch({
    control,
    name: titleWatchPath,
    defaultValue: ''
  });

  // 根据activeType和activePath决定使用哪个order值
  const currentOrder = activeType === 'section' && activePath ? sectionOrderValue : null;
  const currentChapterOrder = activeType === 'chapter' && activePath ? chapterOrderValue : null;

  // 获取默认名称
  const getDefaultTitle = (): string => {
    if (activeType === 'chapter') {
      const chapterIndex = getChapterIndex(activePath);
      return chapterIndex !== null ? `第${chapterIndex + 1}章` : '章';
    } else if (activeType === 'section') {
      const sectionInfo = getSectionIndex(activePath);
      if (sectionInfo) {
        // 计算全局节序号
        let globalSectionIndex = 0;
        for (let i = 0; i < sectionInfo.chapterIndex; i++) {
          globalSectionIndex += (chapters?.[i]?.sections?.length || 0);
        }
        globalSectionIndex += sectionInfo.sectionIndex;
        return `第${globalSectionIndex + 1}节`;
      }
      return '节';
    }
    return '';
  };

  // 显示标题（如果有则显示，否则显示默认名称）
  const displayTitle = currentTitle || getDefaultTitle();

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (activePath && activeType && (activeType === 'chapter' || activeType === 'section') && onDelete) {
      onDelete(activePath, activeType);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  if (!activePath || !activeType) {
    return (
      <div className="flex-1 p-10 text-gray-500 text-center">
        <p className="text-lg">请点击左侧目录节点进行编辑</p>
      </div>
    );
  }

  return (
    <div key={activePath} className="flex-1 p-8 overflow-y-auto">
      <div className="border-b border-gray-200 pb-3 mb-6 flex items-center justify-between">
        <div>
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${activeType === 'course' ? 'bg-blue-500 text-white' :
            activeType === 'chapter' ? 'bg-indigo-500 text-white' :
              'bg-green-500 text-white'
            }`}>
            {activeType === 'course' ? '课程编辑' : activeType === 'chapter' ? '章编辑' : '节编辑'}
          </span>
          <span className="ml-3 text-gray-500 text-sm">路径: {activePath}</span>
        </div>
        {/* 删除按钮（只在章或节时显示） */}
        {(activeType === 'chapter' || activeType === 'section') && (
          <button
            onClick={handleDeleteClick}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            删除
          </button>
        )}
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">确认删除</h3>
            <p className="text-gray-700 mb-6">
              确定要删除{activeType === 'chapter' ? '章' : '节'} <strong>"{displayTitle}"</strong> 吗？
              {activeType === 'chapter' && '删除章将同时删除该章下的所有节。'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============== 课程 (Course) 编辑器 ============== */}
      {activeType === 'course' && (
        <div className="space-y-4">
          {/* ID字段隐藏，但保留在表单中 */}
          <input type="hidden" {...register('id')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程标题</label>
            <input
              {...register('title')}
              placeholder="输入课程标题..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程描述</label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="输入课程描述..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* ============== 章 (Chapter) 编辑器 ============== */}
      {activeType === 'chapter' && (
        <div className="space-y-4">
          {/* ID字段隐藏，但保留在表单中 */}
          <input type="hidden" {...register(`${activePath}.id`)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              章标题 {!currentTitle && <span className="text-gray-400 text-xs">(默认: {getDefaultTitle()})</span>}
            </label>
            <input
              {...register(`${activePath}.title`)}
              placeholder={getDefaultTitle()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {!currentTitle && (
              <p className="text-xs text-gray-500 mt-1">当前显示名称: {getDefaultTitle()}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">排序（自动计算）</label>
            <input
              type="number"
              {...register(`${activePath}.order`, { valueAsNumber: true })}
              value={currentChapterOrder ?? 0}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">排序序号由系统自动计算，按章节顺序单调递增（从0开始）</p>
          </div>
        </div>
      )}

      {/* ============== 节 (Section) 编辑器 ============== */}
      {activeType === 'section' && (
        <div className="space-y-4">
          {/* ID字段隐藏，但保留在表单中 */}
          <input type="hidden" {...register(`${activePath}.id`)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              节标题 {!currentTitle && <span className="text-gray-400 text-xs">(默认: {getDefaultTitle()})</span>}
            </label>
            <input
              {...register(`${activePath}.title`)}
              placeholder={getDefaultTitle()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {!currentTitle && (
              <p className="text-xs text-gray-500 mt-1">当前显示名称: {getDefaultTitle()}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">排序（自动计算）</label>
            <input
              type="number"
              {...register(`${activePath}.order`, { valueAsNumber: true })}
              value={currentOrder ?? 0}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">排序序号由系统自动计算，按课程中所有节的顺序单调递增（从0开始）</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">预计时长（分钟）</label>
            <input
              type="number"
              {...register(`${activePath}.estimated_time`, { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">视频URL</label>
            <input
              {...register(`${activePath}.video_url`)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <hr className="my-6 border-gray-200" />

          {/* 引导问题管理 */}
          <LeadingQuestionsManager key={`questions-${activePath}`} activePath={activePath} />

          <hr className="my-6 border-gray-200" />

          {/* 练习题管理 */}
          <ExercisesManager key={`exercises-${activePath}`} activePath={activePath} />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// 3. 子组件：引导问题管理器
// ---------------------------------------------------------
interface LeadingQuestionsManagerProps {
  activePath: string;
}

const LeadingQuestionsManager: React.FC<LeadingQuestionsManagerProps> = ({ activePath }) => {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${activePath}.leading_questions`
  });

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">引导问题</h3>
        <button
          type="button"
          onClick={() => append({ id: `uuid-${Date.now()}`, question: "" })}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          + 添加问题
        </button>
      </div>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2 mb-2 items-start">
          <span className="font-semibold mt-2">Q{index + 1}:</span>
          <div className="flex-1">
            {/* ID字段隐藏，但保留在表单中 */}
            <input type="hidden" {...register(`${activePath}.leading_questions.${index}.id`)} />
            <input
              {...register(`${activePath}.leading_questions.${index}.question`)}
              placeholder="问题描述"
              className="w-full px-2 py-1 border border-gray-300 rounded"
            />
          </div>
          <button
            type="button"
            onClick={() => remove(index)}
            className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
          >
            删除
          </button>
        </div>
      ))}
      {fields.length === 0 && (
        <p className="text-gray-400 text-sm">暂无引导问题，点击上方按钮添加</p>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// 4. 子组件：练习题管理器
// ---------------------------------------------------------
interface ExercisesManagerProps {
  activePath: string;
}

const ExercisesManager: React.FC<ExercisesManagerProps> = ({ activePath }) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${activePath}.exercises`
  });

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">练习题</h3>
        <button
          type="button"
          onClick={() => append({
            id: `uuid-${Date.now()}`,
            question: "",
            score: 0,
            type: "单选",
            options: []
          })}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
        >
          + 添加练习题
        </button>
      </div>
      {fields.map((field, index) => (
        <ExerciseItem
          key={field.id}
          activePath={activePath}
          index={index}
          onRemove={() => remove(index)}
        />
      ))}
      {fields.length === 0 && (
        <p className="text-gray-400 text-sm">暂无练习题，点击上方按钮添加</p>
      )}
    </div>
  );
};

interface ExerciseItemProps {
  activePath: string;
  index: number;
  onRemove: () => void;
}

const ExerciseItem: React.FC<ExerciseItemProps> = ({ activePath, index, onRemove }) => {
  const { register, control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${activePath}.exercises.${index}.options`
  });

  return (
    <div className="bg-white p-3 rounded border border-gray-200 mb-3">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">题目 {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
        >
          删除题目
        </button>
      </div>
      <div className="space-y-2">
        {/* ID字段隐藏，但保留在表单中 */}
        <input type="hidden" {...register(`${activePath}.exercises.${index}.id`)} />
        <input
          {...register(`${activePath}.exercises.${index}.question`)}
          placeholder="问题描述"
          className="w-full px-2 py-1 border border-gray-300 rounded"
        />
        <div className="flex gap-2">
          <input
            type="number"
            {...register(`${activePath}.exercises.${index}.score`, { valueAsNumber: true })}
            placeholder="分值"
            className="w-24 px-2 py-1 border border-gray-300 rounded"
          />
          <select
            {...register(`${activePath}.exercises.${index}.type`)}
            className="flex-1 px-2 py-1 border border-gray-300 rounded"
          >
            <option value="单选">单选</option>
            <option value="多选">多选</option>
            <option value="简答">简答</option>
          </select>
        </div>

        {/* 选项列表 */}
        <div className="mt-3 pl-4 border-l-2 border-gray-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">选项</span>
            <button
              type="button"
              onClick={() => append({ id: `uuid-${Date.now()}`, text: "", is_correct: false })}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
            >
              + 添加选项
            </button>
          </div>
          {fields.map((optionField, optIdx) => (
            <div key={optionField.id} className="flex gap-2 mb-2 items-center">
              <input
                type="checkbox"
                {...register(`${activePath}.exercises.${index}.options.${optIdx}.is_correct`)}
                className="w-4 h-4"
              />
              {/* ID字段隐藏，但保留在表单中 */}
              <input type="hidden" {...register(`${activePath}.exercises.${index}.options.${optIdx}.id`)} />
              <input
                {...register(`${activePath}.exercises.${index}.options.${optIdx}.text`)}
                placeholder="选项文本"
                className="flex-1 px-2 py-1 border border-gray-300 rounded"
              />
              <button
                type="button"
                onClick={() => remove(optIdx)}
                className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-xs"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 5. 主入口组件
// ---------------------------------------------------------
interface CourseEditorProps {
  initialData?: CourseData;
  onSave?: (data: CourseData) => void;
}

const CourseEditor: React.FC<CourseEditorProps> = ({ initialData, onSave }) => {
  const defaultValues: CourseData = initialData || {
    id: "uuidv4",
    title: "",
    description: "",
    chapters: []
  };

  const methods = useForm<CourseData>({
    defaultValues
  });

  // 当initialData变化时，更新表单数据
  useEffect(() => {
    if (initialData) {
      methods.reset(initialData);
    }
  }, [initialData, methods]);

  const [activeNode, setActiveNode] = useState<{ path: string | null; type: 'course' | 'chapter' | 'section' | null }>({
    path: null,
    type: null
  });

  const { control } = methods;

  // 重新计算所有section的order（全局单调递增）
  const recalculateSectionOrders = useCallback(() => {
    const chapters = methods.getValues('chapters') || [];
    let globalOrder = 0;
    const updatedChapters = chapters.map((chapter: Chapter) => {
      const sections = chapter.sections || [];
      const updatedSections = sections.map((section: Section) => {
        const updatedSection = { ...section, order: globalOrder };
        globalOrder++;
        return updatedSection;
      });
      return { ...chapter, sections: updatedSections };
    });
    methods.setValue('chapters', updatedChapters, { shouldValidate: false, shouldDirty: false });
  }, [methods]);

  // 监听chapters中所有sections的数量变化，自动重新计算order
  const chapters = useWatch({ control, name: 'chapters' });
  const totalSections = chapters?.reduce((total: number, chapter: Chapter) =>
    total + (chapter.sections?.length || 0), 0) || 0;

  // 使用ref来跟踪上一次的sections总数，避免不必要的重新计算
  const prevTotalSectionsRef = useRef(totalSections);

  useEffect(() => {
    // 只在sections总数真正变化时重新计算，避免循环更新
    if (chapters && chapters.length > 0 && prevTotalSectionsRef.current !== totalSections) {
      prevTotalSectionsRef.current = totalSections;
      recalculateSectionOrders();
    }
  }, [totalSections, recalculateSectionOrders, chapters]);

  // 添加章
  const handleAddChapter = () => {
    const chapters = methods.getValues('chapters') || [];
    const newChapter: Chapter = {
      id: `uuid-${Date.now()}`,
      title: "",
      order: chapters.length,
      sections: []
    };
    methods.setValue('chapters', [...chapters, newChapter]);
    setActiveNode({ path: `chapters.${chapters.length}`, type: 'chapter' });
  };

  // 添加节
  const handleAddSection = (chapterIndex: number) => {
    const chapters = methods.getValues('chapters') || [];
    const chapter = chapters[chapterIndex];
    if (!chapter) return;

    const sections = chapter.sections || [];
    // order会在recalculateSectionOrders中自动计算
    const newSection: Section = {
      id: `uuid-${Date.now()}`,
      title: "",
      order: 0, // 临时值，会被自动计算覆盖
      estimated_time: 0,
      video_url: "",
      leading_questions: [],
      exercises: []
    };

    const updatedChapters = [...chapters];
    updatedChapters[chapterIndex] = {
      ...chapter,
      sections: [...sections, newSection]
    };
    methods.setValue('chapters', updatedChapters);

    // 重新计算所有section的order
    setTimeout(() => {
      recalculateSectionOrders();
      setActiveNode({ path: `chapters.${chapterIndex}.sections.${sections.length}`, type: 'section' });
    }, 0);
  };

  // 移动节
  const handleMoveSection = useCallback((
    sourceChapterIndex: number,
    sourceSectionIndex: number,
    targetChapterIndex: number,
    targetSectionIndex: number
  ) => {
    const chapters = methods.getValues('chapters') || [];
    const sourceChapter = chapters[sourceChapterIndex];
    const targetChapter = chapters[targetChapterIndex];

    if (!sourceChapter || !targetChapter) return;

    const sourceSections = [...(sourceChapter.sections || [])];
    const targetSections = sourceChapterIndex === targetChapterIndex
      ? sourceSections
      : [...(targetChapter.sections || [])];

    // 获取要移动的节
    const sectionToMove = sourceSections[sourceSectionIndex];
    if (!sectionToMove) return;

    // 同章内移动：检查是否是无效移动
    if (sourceChapterIndex === targetChapterIndex) {
      if (targetSectionIndex === sourceSectionIndex || targetSectionIndex === sourceSectionIndex + 1) {
        return;
      }
    }

    // 从源位置移除
    sourceSections.splice(sourceSectionIndex, 1);

    // 计算插入位置
    const insertIndex = sourceChapterIndex === targetChapterIndex && targetSectionIndex > sourceSectionIndex
      ? targetSectionIndex - 1  // 同章且目标在后，需要-1
      : targetSectionIndex;

    // 插入到目标位置
    targetSections.splice(insertIndex, 0, sectionToMove);

    // 更新章节数据
    const updatedChapters = [...chapters];
    updatedChapters[sourceChapterIndex] = {
      ...sourceChapter,
      sections: sourceSections
    };
    if (sourceChapterIndex !== targetChapterIndex) {
      updatedChapters[targetChapterIndex] = {
        ...targetChapter,
        sections: targetSections
      };
    }
    methods.setValue('chapters', updatedChapters);

    // 重新计算所有section的order并更新选中状态
    setTimeout(() => {
      recalculateSectionOrders();
      setActiveNode({
        path: `chapters.${targetChapterIndex}.sections.${insertIndex}`,
        type: 'section'
      });
    }, 0);
  }, [methods, recalculateSectionOrders]);

  // 删除章或节
  const handleDelete = (path: string, type: 'chapter' | 'section') => {
    const chapters = methods.getValues('chapters') || [];

    if (type === 'chapter') {
      // 删除章：解析路径 chapters.0 -> 0
      const match = path.match(/chapters\.(\d+)/);
      if (!match) return;
      const chapterIndex = parseInt(match[1], 10);

      // 从数组中删除该章
      const updatedChapters = chapters.filter((_: Chapter, index: number) => index !== chapterIndex);

      // 重新计算章的order
      const reorderedChapters = updatedChapters.map((chapter: Chapter, index: number) => ({
        ...chapter,
        order: index
      }));

      methods.setValue('chapters', reorderedChapters);

      // 重新计算所有section的order
      setTimeout(() => {
        recalculateSectionOrders();
      }, 0);

      // 清除选中状态或选中第一个章
      if (reorderedChapters.length > 0) {
        setActiveNode({ path: 'chapters.0', type: 'chapter' });
      } else {
        setActiveNode({ path: 'root', type: 'course' });
      }
    } else if (type === 'section') {
      // 删除节：解析路径 chapters.0.sections.1 -> chapterIndex=0, sectionIndex=1
      const match = path.match(/chapters\.(\d+)\.sections\.(\d+)/);
      if (!match) return;
      const chapterIndex = parseInt(match[1], 10);
      const sectionIndex = parseInt(match[2], 10);

      const chapter = chapters[chapterIndex];
      if (!chapter) return;

      // 从该章的sections数组中删除该节
      const sections = chapter.sections || [];
      const updatedSections = sections.filter((_: Section, index: number) => index !== sectionIndex);

      const updatedChapters = [...chapters];
      updatedChapters[chapterIndex] = {
        ...chapter,
        sections: updatedSections
      };

      methods.setValue('chapters', updatedChapters);

      // 重新计算所有section的order
      setTimeout(() => {
        recalculateSectionOrders();
      }, 0);

      // 清除选中状态或选中该章或该章的其他节
      if (updatedSections.length > 0) {
        // 选中该章的下一个节，如果没有下一个则选中该章
        const nextSectionIndex = sectionIndex < updatedSections.length ? sectionIndex : sectionIndex - 1;
        setActiveNode({ path: `chapters.${chapterIndex}.sections.${nextSectionIndex}`, type: 'section' });
      } else {
        setActiveNode({ path: `chapters.${chapterIndex}`, type: 'chapter' });
      }
    }
  };

  const handleSave = (data: CourseData) => {
    if (onSave) {
      onSave(data);
    } else {
      console.log("最终保存的 JSON:", JSON.stringify(data, null, 2));
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col h-screen bg-white">
        <header className="px-6 py-4 border-b border-gray-300 flex justify-between items-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <h2 className="text-xl font-semibold">课程结构编辑器</h2>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：结构导航 */}
          <SidebarTree
            control={control}
            onSelect={(path, type) => setActiveNode({ path, type })}
            activePath={activeNode.path}
            onAddSection={handleAddSection}
            onAddChapter={handleAddChapter}
            onMoveSection={handleMoveSection}
          />

          {/* 右侧：数据编辑 */}
          <PropertyEditor
            activePath={activeNode.path}
            activeType={activeNode.type}
            onDelete={handleDelete}
          />
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-3 border-t border-gray-300 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {activeNode.path && `当前编辑: ${activeNode.path}`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={methods.handleSubmit(handleSave)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
            >
              保存 JSON
            </button>
          </div>
        </div>
      </div>
    </FormProvider>
  );
};

export default CourseEditor;


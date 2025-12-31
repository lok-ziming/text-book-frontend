import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Alert from './Alert';
import { Model, AppConfig, AlertProps, CreateTaskRequest } from '../types';

interface TaskConfigProps {
  models: Model[];
  appConfig: AppConfig;
  onTaskSubmit: (taskData: CreateTaskRequest) => Promise<void>;
  alert: AlertProps | null;
  onConfigChange: (updates: Partial<AppConfig>) => Promise<void>;
}

interface TaskFormData {
  videoUrls: string;
  customFolderName: string;
  downloadAllParts: boolean;
  maxConcurrentTasks: number;
  genSummary: boolean;
  genFullContent: boolean;
  genExercises: boolean;
  genQuestions: boolean;
  outputDir: string;
  modelName: string;
}

export default function TaskConfig({
  models,
  appConfig,
  onTaskSubmit,
  alert,
  onConfigChange,
}: TaskConfigProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    videoUrls: '',
    customFolderName: '',
    downloadAllParts: false,
    maxConcurrentTasks: 2,
    genSummary: true,
    genFullContent: true,
    genExercises: true,
    genQuestions: true,
    outputDir: 'subtitles',
    modelName: '',
  });

  useEffect(() => {
    if (appConfig) {
      setFormData((prev) => ({
        ...prev,
        outputDir: appConfig.output_directory || 'subtitles',
        downloadAllParts: appConfig.download_all_parts || false,
        maxConcurrentTasks: appConfig.max_concurrent_tasks || 2,
        modelName: appConfig.last_selected_model || '',
      }));
    }
  }, [appConfig]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const urls = formData.videoUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u);

    if (urls.length === 0) {
      return;
    }

    if (!formData.modelName) {
      return;
    }

    const generateOptions = {
      summary: formData.genSummary,
      full_content: formData.genFullContent,
      exercises: formData.genExercises,
      questions: formData.genQuestions,
    };

    await onTaskSubmit({
      urls,
      output_dir: formData.outputDir,
      model_name: formData.modelName,
      custom_folder_name: formData.customFolderName,
      download_all_parts: formData.downloadAllParts,
      generate_options: generateOptions,
    });

    setFormData((prev) => ({ ...prev, videoUrls: '' }));
  };

  const handleOutputDirBlur = async () => {
    if (formData.outputDir.trim()) {
      await onConfigChange({ output_directory: formData.outputDir.trim() });
    }
  };

  const handleDownloadAllPartsChange = async (checked: boolean) => {
    setFormData((prev) => ({ ...prev, downloadAllParts: checked }));
    await onConfigChange({ download_all_parts: checked });
  };

  const handleMaxConcurrentChange = async (value: string) => {
    const numValue = parseInt(value);
    if (numValue >= 1 && numValue <= 10) {
      setFormData((prev) => ({ ...prev, maxConcurrentTasks: numValue }));
      await onConfigChange({ max_concurrent_tasks: numValue });
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center mb-4">
        <div className="w-1 h-5 bg-blue-500 rounded mr-2.5"></div>
        <h2 className="text-lg font-semibold text-gray-800">任务配置</h2>
      </div>

      {alert && <Alert {...alert} />}

      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            视频URL（每行一个）
          </label>
          <textarea
            className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y min-h-[120px] font-inherit"
            placeholder="支持视频URL：&#10;https://www.bilibili.com/video/BV1xx411c7mu&#10;&#10;支持分P视频URL：&#10;https://www.bilibili.com/video/BV1xx411c7mu?p=2&#10;&#10;支持收藏夹URL：&#10;https://space.bilibili.com/UID/favlist?fid=收藏夹ID"
            value={formData.videoUrls}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, videoUrls: e.target.value })
            }
            required
          />
          <div className="text-xs text-gray-600 mt-1">
            💡 提示：支持单个视频URL、多个视频URL和收藏夹URL混合输入，收藏夹会自动展开
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            自定义文件夹名称（可选）
          </label>
          <input
            type="text"
            className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="留空则使用视频标题作为文件夹名称"
            value={formData.customFolderName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, customFolderName: e.target.value })
            }
          />
          <div className="text-xs text-gray-600 mt-1">
            💡 提示：多个URL时，指定此选项可将所有视频文件放在同一个文件夹内
          </div>
        </div>

        <div className="mb-5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="cursor-pointer w-[18px] h-[18px]"
              checked={formData.downloadAllParts}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleDownloadAllPartsChange(e.target.checked)
              }
            />
            <span className="block text-sm font-medium text-gray-700">下载所有分P视频</span>
          </label>
          <div className="text-xs text-gray-600 mt-1 ml-7">
            💡 提示：关闭时（默认），只下载URL指定的那一个视频；开启时，下载该视频的所有分P
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            最大并发任务数
          </label>
          <input
            type="number"
            className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            min="1"
            max="10"
            value={formData.maxConcurrentTasks}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleMaxConcurrentChange(e.target.value)
            }
            placeholder="同时处理的视频数量"
          />
          <div className="text-xs text-gray-600 mt-1">
            💡 提示：同时处理的视频数量。设置为1可避免API并发限制，设置为2-3可提高效率（需要API支持）
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">生成内容选项</label>
          <div className="flex gap-4 flex-wrap p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.genSummary}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, genSummary: e.target.checked })
                }
              />
              <span>要点总结</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.genFullContent}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, genFullContent: e.target.checked })
                }
              />
              <span>完整文档</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.genExercises}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, genExercises: e.target.checked })
                }
              />
              <span>练习题</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.genQuestions}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, genQuestions: e.target.checked })
                }
              />
              <span>预设问题</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2.5 mb-5">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">输出根目录</label>
            <input
              type="text"
              className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={formData.outputDir}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, outputDir: e.target.value })
              }
              onBlur={handleOutputDirBlur}
              placeholder="例如: subtitles 或 D:/Videos/subtitles"
              required
            />
            <div className="text-xs text-gray-600 mt-1">
              支持相对路径（subtitles）或绝对路径（D:/Videos/subtitles）
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择模型</label>
            <select
              className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={formData.modelName}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, modelName: e.target.value })
              }
              required
            >
              <option value="">请选择模型</option>
              {models.map((model) => (
                <option key={model.id} value={model.name}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          开始处理
        </button>
      </form>
    </div>
  );
}


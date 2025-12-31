import { useState, useEffect, useCallback } from 'react';
import ModelConfig from './components/ModelConfig';
import TaskConfig from './components/TaskConfig';
import TaskList from './components/TaskList';
import {
  Model,
  Task,
  AppConfig,
  AlertProps,
  CreateTaskRequest,
  ConfigResponse,
  CookiesConfigResponse,
  ModelsResponse,
  CreateTaskResponse,
  TasksResponse,
  ApiResponse,
} from './types';
import './App.css';

function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [appConfig, setAppConfig] = useState<AppConfig>({});
  const [modelAlert, setModelAlert] = useState<AlertProps | null>(null);
  const [taskAlert, setTaskAlert] = useState<AlertProps | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // 加载应用配置
  const loadAppConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/config');

      if (!response.ok) {
        console.warn('加载配置失败:', response.status, response.statusText);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('配置API返回的不是JSON格式，后端服务可能未启动');
        return;
      }

      const data: ConfigResponse = await response.json();

      if (data.success && data.config) {
        setAppConfig(data.config);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }, []);

  // 保存应用配置
  const saveAppConfig = useCallback(async (updates: Partial<AppConfig>) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data: ConfigResponse = await response.json();
      if (data.success && data.config) {
        setAppConfig(data.config);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }, []);

  // 检查Cookie配置
  const checkCookiesConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/config/cookies');

      if (!response.ok) {
        return; // 静默失败，不影响主流程
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return; // 静默失败
      }

      const data: CookiesConfigResponse = await response.json();

      if (!data.configured) {
        setTaskAlert({
          message: '提示：请先配置cookies.txt文件中的SESSDATA，否则无法下载AI字幕',
          type: 'warning',
        });
      }
    } catch (error) {
      console.error('检查Cookie配置失败:', error);
    }
  }, []);

  // 加载模型列表
  const loadModels = useCallback(async () => {
    try {
      const response = await fetch('/api/models');

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }

      // 检查内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(
          `服务器返回的不是JSON格式。可能是后端服务未启动或API路径配置错误。响应内容: ${text.substring(0, 100)}`
        );
      }

      const data: ModelsResponse = await response.json();

      if (data.success && data.models) {
        setModels(data.models);
      } else {
        setModelAlert({ message: '加载模型失败: ' + (data.error || '未知错误'), type: 'error' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setModelAlert({
        message: '加载模型失败: ' + errorMessage + '。请确保后端服务已启动并正确配置API路径。',
        type: 'error',
      });
    }
  }, []);

  // 添加模型
  const handleAddModel = useCallback(
    async (modelData: Omit<Model, 'id'>) => {
      try {
        const response = await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelData),
        });

        const data: ApiResponse = await response.json();

        if (data.success) {
          setModelAlert({ message: '添加成功', type: 'success' });
          await loadModels();
          setTimeout(() => setModelAlert(null), 3000);
        } else {
          alert('操作失败: ' + (data.error || '未知错误'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        alert('操作失败: ' + errorMessage);
      }
    },
    [loadModels]
  );

  // 编辑模型
  const handleEditModel = useCallback(
    async (modelId: string, modelData: Omit<Model, 'id'>) => {
      try {
        const response = await fetch(`/api/models/${modelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelData),
        });

        const data: ApiResponse = await response.json();

        if (data.success) {
          setModelAlert({ message: '更新成功', type: 'success' });
          await loadModels();
          setTimeout(() => setModelAlert(null), 3000);
        } else {
          alert('操作失败: ' + (data.error || '未知错误'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        alert('操作失败: ' + errorMessage);
      }
    },
    [loadModels]
  );

  // 删除模型
  const handleDeleteModel = useCallback(
    async (modelId: string) => {
      try {
        const response = await fetch(`/api/models/${modelId}`, {
          method: 'DELETE',
        });

        const data: ApiResponse = await response.json();

        if (data.success) {
          setModelAlert({ message: '删除成功', type: 'success' });
          await loadModels();
          setTimeout(() => setModelAlert(null), 3000);
        } else {
          setModelAlert({ message: '删除失败: ' + (data.error || '未知错误'), type: 'error' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        setModelAlert({ message: '删除失败: ' + errorMessage, type: 'error' });
      }
    },
    [loadModels]
  );

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks');
      const data: TasksResponse = await response.json();

      if (data.success && data.tasks) {
        const tasksMap: Record<string, Task> = {};
        data.tasks.forEach((task) => {
          tasksMap[task.id] = task;
        });
        setTasks(tasksMap);

        // 如果所有任务都完成、失败、停止中或已停止，停止轮询
        const allDone = data.tasks.every(
          (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'stopped'
        );
        const hasStopping = data.tasks.some((t) => t.status === 'stopping');

        if (allDone && !hasStopping && data.tasks.length > 0) {
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
        }
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  }, [pollInterval]);

  // 开始轮询任务状态
  const startPolling = useCallback(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    loadTasks(); // 立即加载一次
    const interval = setInterval(loadTasks, 2000); // 每2秒刷新
    setPollInterval(interval);
  }, [loadTasks, pollInterval]);

  // 处理任务提交
  const handleTaskSubmit = useCallback(
    async (taskData: CreateTaskRequest) => {
      const urls = taskData.urls;
      if (urls.length === 0) {
        setTaskAlert({ message: '请输入至少一个视频URL', type: 'error' });
        return;
      }

      if (!taskData.model_name) {
        setTaskAlert({ message: '请选择模型', type: 'error' });
        return;
      }

      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });

        const data: CreateTaskResponse = await response.json();

        if (data.success) {
          const message = data.total_videos
            ? `已创建 ${data.task_ids.length} 个任务，共 ${data.total_videos} 个视频`
            : `已创建 ${data.task_ids.length} 个任务`;
          setTaskAlert({ message, type: 'success' });
          setTimeout(() => setTaskAlert(null), 3000);

          // 保存选择的模型
          await saveAppConfig({ last_selected_model: taskData.model_name });

          // 开始轮询任务状态
          startPolling();
        } else {
          setTaskAlert({ message: '创建任务失败: ' + (data.error || '未知错误'), type: 'error' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        setTaskAlert({ message: '创建任务失败: ' + errorMessage, type: 'error' });
      }
    },
    [saveAppConfig, startPolling]
  );

  // 停止任务
  const handleStopTask = useCallback(
    async (taskId: string) => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/stop`, {
          method: 'POST',
        });

        const data: ApiResponse = await response.json();

        if (data.success) {
          loadTasks();
        } else {
          setTaskAlert({ message: '停止任务失败: ' + (data.error || '未知错误'), type: 'error' });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        setTaskAlert({ message: '停止任务失败: ' + errorMessage, type: 'error' });
      }
    },
    [loadTasks]
  );

  // 初始化
  useEffect(() => {
    loadAppConfig();
    loadModels();
    checkCookiesConfig();
  }, [loadAppConfig, loadModels, checkCookiesConfig]);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-5">
      <div className="max-w-[1200px] mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-8 text-center">
          <h1 className="text-3xl font-semibold mb-2.5">Bilibili视频字幕下载与总结</h1>
          <p className="opacity-90 text-sm">
            批量下载B站视频字幕，AI自动生成内容总结 · 支持收藏夹批量处理
          </p>
        </div>

        <div className="p-8">
          <ModelConfig
            models={models}
            onAddModel={handleAddModel}
            onEditModel={handleEditModel}
            onDeleteModel={handleDeleteModel}
            alert={modelAlert}
          />

          <TaskConfig
            models={models}
            appConfig={appConfig}
            onTaskSubmit={handleTaskSubmit}
            alert={taskAlert}
            onConfigChange={saveAppConfig}
          />

          <TaskList tasks={tasks} onStopTask={handleStopTask} />
        </div>
      </div>
    </div>
  );
}

export default App;


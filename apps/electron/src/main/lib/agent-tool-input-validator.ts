/**
 * 工具参数校验模块
 *
 * 在 canUseTool 回调中拦截参数缺失或路径不安全的工具调用，
 * 返回描述性 deny message 引导模型重试。
 */

import { homedir } from 'node:os'
import { resolve } from 'node:path'

/** 已知工具的必需参数映射 */
export const TOOL_REQUIRED_PARAMS: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  ['Write', ['file_path', 'content']],
  ['Edit', ['file_path', 'old_string', 'new_string']],
  ['Bash', ['command']],
  ['Read', ['file_path']],
  ['Glob', ['pattern']],
  ['Grep', ['pattern']],
  ['Agent', ['prompt', 'description']],
])

/** 允许 Agent 操作的文件路径前缀 */
const ALLOWED_PATH_PREFIXES: ReadonlyArray<string> = [
  homedir(),                    // ~/ 及其下所有目录
]

/** 禁止 Agent 操作的系统敏感路径（相对于 home 目录）*/
const BLOCKED_RELATIVE_PATHS: ReadonlyArray<string> = [
  '.ssh',
  '.gnupg',
  '.aws',
  '.config',
  '.gitconfig',
  '.kube',
  '.docker',
]

/** Windows 禁止的绝对路径前缀 */
const BLOCKED_WIN_PREFIXES: ReadonlyArray<string> = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\ProgramData',
  'C:\\System32',
  '\\Windows',
  '\\Program Files',
]

/** Unix 禁止的绝对路径前缀 */
const BLOCKED_UNIX_PREFIXES: ReadonlyArray<string> = [
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/System',
  '/Library',
]

/**
 * 判断文件路径是否安全（不越界到系统目录或敏感配置目录）
 */
function isPathSafe(filePath: string): { safe: boolean; reason?: string } {
  const resolved = resolve(filePath)

  // Windows 系统目录检查
  for (const prefix of BLOCKED_WIN_PREFIXES) {
    if (resolved.toLowerCase().startsWith(prefix.toLowerCase())) {
      return { safe: false, reason: `不允许操作系统目录: ${prefix}` }
    }
  }

  // Unix 系统目录检查
  for (const prefix of BLOCKED_UNIX_PREFIXES) {
    if (resolved.startsWith(prefix)) {
      return { safe: false, reason: `不允许操作系统目录: ${prefix}` }
    }
  }

  // 检查是否在允许的路径前缀内
  const isAllowed = ALLOWED_PATH_PREFIXES.some((prefix) =>
    resolved.toLowerCase().startsWith(prefix.toLowerCase()),
  )
  if (!isAllowed) {
    return { safe: false, reason: '只允许操作 home 目录下的文件' }
  }

  // 检查是否在禁止的相对路径中
  for (const relPath of BLOCKED_RELATIVE_PATHS) {
    const blockedFull = resolve(homedir(), relPath)
    if (resolved.toLowerCase().startsWith(blockedFull.toLowerCase())) {
      return { safe: false, reason: `不允许操作敏感目录: ~/${relPath}` }
    }
  }

  return { safe: true }
}

/** 校验失败结果，与 PermissionResult deny 形状一致 */
export interface ToolValidationFailure {
  behavior: 'deny'
  message: string
}

/**
 * 校验工具调用的必需参数是否存在且非空。
 * 对文件操作工具额外检查路径是否安全。
 *
 * 校验通过时返回 null；
 * 参数缺失或路径不安全时返回 deny 结果。
 */
export function validateToolInput(
  toolName: string,
  input: Record<string, unknown>,
): ToolValidationFailure | null {
  const requiredParams = TOOL_REQUIRED_PARAMS.get(toolName)
  if (!requiredParams) return null

  const missing: string[] = []
  for (const param of requiredParams) {
    const value = input[param]
    if (value === undefined || value === null || value === '') {
      missing.push(param)
    }
  }

  if (missing.length > 0) {
    const paramList = missing.map((p) => `"${p}"`).join(', ')
    const message = missing.length === 1
      ? `Tool "${toolName}" is missing required parameter ${paramList}. Please retry with all required parameters filled in.`
      : `Tool "${toolName}" is missing required parameters: ${paramList}. Please retry with all required parameters filled in.`
    return { behavior: 'deny' as const, message }
  }

  // 对文件操作工具检查路径安全
  if (['Write', 'Edit', 'Read'].includes(toolName)) {
    const filePath = typeof input.file_path === 'string' ? input.file_path : ''
    if (filePath) {
      const result = isPathSafe(filePath)
      if (!result.safe) {
        return {
          behavior: 'deny' as const,
          message: `Tool "${toolName}" path rejected: ${result.reason}. Please use a file in your home directory.`,
        }
      }
    }
  }

  return null
}

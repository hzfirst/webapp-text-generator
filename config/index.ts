import type { AppInfo } from '@/types/app'
export const APP_ID = `${process.env.NEXT_PUBLIC_APP_ID}`
export const IS_WORKFLOW = `${process.env.NEXT_PUBLIC_APP_TYPE_WORKFLOW}` === 'true'
export const APP_INFO: AppInfo = {
  title: '宠医知识助手',
  description: '输入业务问题，快速查看操作说明和相关截图',
  copyright: '宠医知识助手',
  privacy_policy: '',
  default_language: 'zh-Hans',
}

export const API_PREFIX = `${process.env.NEXT_PUBLIC_API_PREFIX || '/api'}`

export const LOCALE_COOKIE_NAME = 'locale'

export const DEFAULT_VALUE_MAX_LEN = 48

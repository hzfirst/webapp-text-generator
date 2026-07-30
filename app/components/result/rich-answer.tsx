'use client'

import React from 'react'

export type MediaItem = {
    source_id?: string
    title?: string
    url?: string
    poster_url?: string
    description?: string
}

export type RichAnswerData = {
    status?: string
    answer?: string
    image_urls?: MediaItem[]
    video_urls?: MediaItem[]
}

/**
 * 兼容：
 * 1. 直接返回对象
 * 2. 返回JSON字符串
 * 3. 包在result字段中
 * 4. 包在structured_output字段中
 */
export function parseRichAnswer(
    value: unknown,
): RichAnswerData | null {
    if (!value)
        return null

    if (typeof value === 'string') {
        const text = value.trim()

        if (!text.startsWith('{'))
            return null

        try {
            return parseRichAnswer(JSON.parse(text))
        }
        catch {
            return null
        }
    }

    if (typeof value !== 'object' || Array.isArray(value))
        return null

    const data = value as Record<string, unknown>

    if (data.result)
        return parseRichAnswer(data.result)

    if (data.structured_output)
        return parseRichAnswer(data.structured_output)

    const hasRichContent
        = typeof data.answer === 'string'
        || Array.isArray(data.image_urls)
        || Array.isArray(data.video_urls)

    if (!hasRichContent)
        return null

    return {
        status:
            typeof data.status === 'string'
                ? data.status
                : '',

        answer:
            typeof data.answer === 'string'
                ? data.answer
                : '',

        image_urls:
            Array.isArray(data.image_urls)
                ? data.image_urls as MediaItem[]
                : [],

        video_urls:
            Array.isArray(data.video_urls)
                ? data.video_urls as MediaItem[]
                : [],
    }
}

function safeUrl(value?: string): string {
    if (!value)
        return ''

    try {
        const url = new URL(value.trim())

        if (url.protocol !== 'http:' && url.protocol !== 'https:')
            return ''

        return url.toString()
    }
    catch {
        return ''
    }
}

const RichAnswer = ({
    data,
}: {
    data: RichAnswerData
}) => {
    const images = data.image_urls || []
    const videos = data.video_urls || []

    return (
        <div className="space-y-8">
            {/* 操作说明 */}
            {data.answer && (
                <section>
                    <div className="mb-3 flex items-center gap-2">
                        <span className="h-5 w-1 rounded-full bg-blue-600" />

                        <h2 className="text-base font-semibold text-slate-900">
                            操作说明
                        </h2>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-4 text-[15px] leading-7 text-slate-700">
                        {data.answer}
                    </div>
                </section>
            )}

            {/* 操作图片 */}
            {images.length > 0 && (
                <section>
                    <div className="mb-4 flex items-center gap-2">
                        <span className="h-5 w-1 rounded-full bg-blue-600" />

                        <h2 className="text-base font-semibold text-slate-900">
                            相关操作图片
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                        {images.map((item, index) => {
                            const imageUrl = safeUrl(item.url)

                            if (!imageUrl)
                                return null

                            return (
                                <figure
                                    key={`${item.source_id || 'image'}-${index}`}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                                >
                                    <a
                                        href={imageUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <img
                                            src={imageUrl}
                                            alt={
                                                item.description
                                                || item.title
                                                || `操作图片${index + 1}`
                                            }
                                            loading="lazy"
                                            className="max-h-[620px] w-full bg-slate-50 object-contain"
                                        />
                                    </a>

                                    {(item.title || item.description) && (
                                        <figcaption className="border-t border-slate-100 px-4 py-3">
                                            {item.title && (
                                                <div className="text-sm font-medium text-slate-800">
                                                    {item.title}
                                                </div>
                                            )}

                                            {item.description && (
                                                <div className="mt-1 text-xs leading-5 text-slate-500">
                                                    {item.description}
                                                </div>
                                            )}
                                        </figcaption>
                                    )}
                                </figure>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* 操作视频 */}
            {videos.length > 0 && (
                <section>
                    <div className="mb-4 flex items-center gap-2">
                        <span className="h-5 w-1 rounded-full bg-blue-600" />

                        <h2 className="text-base font-semibold text-slate-900">
                            操作视频
                        </h2>
                    </div>

                    <div className="space-y-5">
                        {videos.map((item, index) => {
                            const videoUrl = safeUrl(item.url)
                            const posterUrl = safeUrl(item.poster_url)

                            if (!videoUrl)
                                return null

                            return (
                                <article
                                    key={`${item.source_id || 'video'}-${index}`}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                                >
                                    <video
                                        controls
                                        playsInline
                                        preload="metadata"
                                        poster={posterUrl || undefined}
                                        className="aspect-video w-full bg-black object-contain"
                                    >
                                        <source src={videoUrl} />

                                        当前浏览器不支持视频播放。
                                    </video>

                                    <div className="flex items-start justify-between gap-4 px-5 py-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900">
                                                {item.title || `操作视频${index + 1}`}
                                            </h3>

                                            {item.description && (
                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>

                                        <a
                                            href={videoUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                                        >
                                            单独打开
                                        </a>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* 未匹配 */}
            {data.status === 'unmatched'
                && !data.answer
                && images.length === 0
                && videos.length === 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                        暂未找到匹配的操作内容，建议联系人工支持。
                    </div>
                )}
        </div>
    )
}

export default React.memo(RichAnswer)
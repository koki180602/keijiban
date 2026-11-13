
// ========================================
// COMMUNITY BOARD
// データ保存・管理（Supabase Storage対応版）
// ========================================

// ========================================
// Supabase接続設定
// ========================================

const SUPABASE_URL = "https://cjszonyivmukhfectyzh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Kns_8BMpE_AyNNTev403Jg_z-oxlMO6";

let supabaseClient = null;

try {
    if (
        window.supabase &&
        !SUPABASE_URL.includes("ここに") &&
        !SUPABASE_ANON_KEY.includes("ここに")
    ) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );
    } else {
        console.warn("Supabaseの接続情報が未設定です。");
    }
} catch (error) {
    console.error("Supabase接続エラー:", error);
}

// ========================================
// 画像設定
// ========================================

const IMAGE_BUCKET = "community-images";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];

// ========================================
// Works本体
// ========================================

const Works = {

    THREAD_TABLE: "threads",
    COMMENT_TABLE: "comments",
    REPORT_TABLE: "reports",

    // ====================================
    // 接続確認
    // ====================================

    isConnected() {
        return supabaseClient !== null;
    },

    // ====================================
    // 画像アップロード
    // ====================================

    async uploadImage(imageData, folder = "threads") {

        if (!imageData) return null;

        // 既にURL形式ならそのまま使用
        if (
            typeof imageData === "string" &&
            imageData.startsWith("http")
        ) {
            return imageData;
        }

        try {
            const response = await fetch(imageData);

            if (!response.ok) {
                throw new Error("画像データを読み込めませんでした。");
            }

            const blob = await response.blob();

            // 8MB制限
            if (blob.size > MAX_IMAGE_SIZE) {
                throw new Error("画像は8MB以下にしてください。");
            }

            // 画像形式チェック
            if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) {
                throw new Error(
                    "JPEG・PNG・WEBP・GIF形式の画像を使用してください。"
                );
            }

            const extensions = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "image/gif": "gif"
            };

            const fileName =
                `${folder}/${crypto.randomUUID()}.${extensions[blob.type]}`;

            const { data, error } = await supabaseClient
                .storage
                .from(IMAGE_BUCKET)
                .upload(fileName, blob, {
                    contentType: blob.type,
                    cacheControl: "3600",
                    upsert: false
                });

            if (error) throw error;

            const { data: publicData } = supabaseClient
                .storage
                .from(IMAGE_BUCKET)
                .getPublicUrl(data.path);

            return publicData.publicUrl;

        } catch (error) {
            console.error("画像アップロードエラー:", error);
            throw error;
        }
    },

    // ====================================
    // スレッド一覧取得
    // ====================================

    async getThreads() {

        if (!supabaseClient) {
            console.error("Supabase未接続");
            return [];
        }

        try {
            const { data: threads, error } = await supabaseClient
                .from(this.THREAD_TABLE)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const { data: comments, error: commentError } =
                await supabaseClient
                    .from(this.COMMENT_TABLE)
                    .select("*")
                    .order("created_at", { ascending: true });

            if (commentError) throw commentError;

            return (threads || []).map(thread => ({
                id: thread.id,
                title: thread.title,
                category: thread.category,
                content: thread.content,
                image: thread.image || null,
                author: thread.author || "匿名ユーザー",
                createdAt: thread.created_at,

                comments: (comments || [])
                    .filter(comment => comment.thread_id === thread.id)
                    .map(comment => ({
                        id: comment.id,
                        parentId: comment.parent_id,
                        content: comment.content,
                        image: comment.image || null,
                        author: comment.author || "匿名ユーザー",
                        createdAt: comment.created_at
                    }))
            }));

        } catch (error) {
            console.error("スレッド取得エラー:", error);
            return [];
        }
    },

    // ====================================
    // スレッド作成
    // ====================================

    async createThread(data) {

        if (!supabaseClient) return null;

        try {

            // 画像をStorageへアップロード
            const imageUrl = data.image
                ? await this.uploadImage(data.image, "threads")
                : null;

            const newThread = {
                id: crypto.randomUUID(),
                title: data.title,
                category: data.category,
                content: data.content,
                image: imageUrl,
                author: "匿名ユーザー"
            };

            const { data: savedThread, error } = await supabaseClient
                .from(this.THREAD_TABLE)
                .insert(newThread)
                .select()
                .single();

            if (error) throw error;

            return {
                id: savedThread.id,
                title: savedThread.title,
                category: savedThread.category,
                content: savedThread.content,
                image: savedThread.image || null,
                author: savedThread.author,
                createdAt: savedThread.created_at,
                comments: []
            };

        } catch (error) {
            console.error("スレッド作成エラー:", error);
            return null;
        }
    },

    // ====================================
    // コメント・返信追加
    // ====================================

    async addComment(
        threadId,
        content,
        parentId = null,
        image = null
    ) {

        if (!supabaseClient) return false;

        try {

            if (parentId) {

                const { data: parent, error: parentError } =
                    await supabaseClient
                        .from(this.COMMENT_TABLE)
                        .select("id")
                        .eq("id", parentId)
                        .eq("thread_id", threadId)
                        .maybeSingle();

                if (parentError) throw parentError;
                if (!parent) return false;
            }

            // コメント画像をStorageへアップロード
            const imageUrl = image
                ? await this.uploadImage(image, "comments")
                : null;

            const newComment = {
                id: crypto.randomUUID(),
                thread_id: threadId,
                parent_id: parentId,
                content: content,
                image: imageUrl,
                author: "匿名ユーザー"
            };

            const { error } = await supabaseClient
                .from(this.COMMENT_TABLE)
                .insert(newComment);

            if (error) throw error;

            return true;

        } catch (error) {
            console.error("コメント保存エラー:", error);
            return false;
        }
    },

    // ====================================
    // 通報一覧取得
    // ====================================

    async getReports() {

        if (!supabaseClient) return [];

        try {

            const { data, error } = await supabaseClient
                .from(this.REPORT_TABLE)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            return (data || []).map(report => ({
                id: report.id,
                threadId: report.thread_id,
                reason: report.reason,
                createdAt: report.created_at,
                status: report.status
            }));

        } catch (error) {
            console.error("通報取得エラー:", error);
            return [];
        }
    },

    // ====================================
    // スレッド通報
    // ====================================

    async reportThread(threadId, reason) {

        if (!supabaseClient) return false;

        try {

            const newReport = {
                id: crypto.randomUUID(),
                thread_id: threadId,
                reason: reason,
                status: "未確認"
            };

            const { error } = await supabaseClient
                .from(this.REPORT_TABLE)
                .insert(newReport);

            if (error) throw error;

            return true;

        } catch (error) {
            console.error("通報保存エラー:", error);
            return false;
        }
    },

    // ====================================
    // スレッド削除
    // ====================================

    async deleteThread(threadId) {

        if (!supabaseClient) return false;

        try {

            const { error } = await supabaseClient
                .from(this.THREAD_TABLE)
                .delete()
                .eq("id", threadId);

            if (error) throw error;

            return true;

        } catch (error) {
            console.error("スレッド削除エラー:", error);
            return false;
        }
    },

    // ====================================
    // コメント削除
    // ====================================

    async deleteComment(threadId, commentId) {

        if (!supabaseClient) return false;

        try {

            const { data: comments, error: fetchError } =
                await supabaseClient
                    .from(this.COMMENT_TABLE)
                    .select("*")
                    .eq("thread_id", threadId);

            if (fetchError) throw fetchError;

            const deleteIds = new Set([commentId]);

            let changed = true;

            while (changed) {

                changed = false;

                (comments || []).forEach(comment => {

                    if (
                        comment.parent_id &&
                        deleteIds.has(comment.parent_id) &&
                        !deleteIds.has(comment.id)
                    ) {
                        deleteIds.add(comment.id);
                        changed = true;
                    }

                });
            }

            const { error } = await supabaseClient
                .from(this.COMMENT_TABLE)
                .delete()
                .in("id", Array.from(deleteIds))
                .eq("thread_id", threadId);

            if (error) throw error;

            return true;

        } catch (error) {
            console.error("コメント削除エラー:", error);
            return false;
        }
    },

    // ====================================
    // 全データ削除
    // ====================================

    async clearAll() {

        console.warn(
            "安全のため、全データ削除は無効にしています。"
        );

        return false;
    }

};


// ========================================
// COMMUNITY BOARD
// データ保存・管理（Supabase版）
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
            const newThread = {
                id: crypto.randomUUID(),
                title: data.title,
                category: data.category,
                content: data.content,
                image: data.image || null,
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

    async addComment(threadId, content, parentId = null, image = null) {

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

            const newComment = {
                id: crypto.randomUUID(),
                thread_id: threadId,
                parent_id: parentId,
                content: content,
                image: image || null,
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

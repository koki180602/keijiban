// ========================================
// COMMUNITY BOARD
// 掲示板メインプログラム（Supabase対応版）
// ========================================

let currentThreadId = null;
let currentSearch = "";
let replyParentId = null;

// ========================================
// HTMLの特殊文字を無害化
// ========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// ========================================
// 日付表示
// ========================================

function formatDate(date) {
    return new Date(date).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ========================================
// 投稿番号
// ========================================

function getPostNumbers(thread) {
    const numbers = new Map();

    numbers.set("thread", 1);

    (thread.comments || []).forEach((comment, index) => {
        numbers.set(comment.id, index + 2);
    });

    return numbers;
}

// ========================================
// スレッドURL
// ========================================

function getThreadURL(threadId) {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("thread", threadId);
    return url.toString();
}

// ========================================
// URLコピー
// ========================================

async function copyThreadURL() {
    if (!currentThreadId) return;

    const url = getThreadURL(currentThreadId);

    try {
        await navigator.clipboard.writeText(url);
        alert("スレッドURLをコピーしました！");
    } catch {
        prompt("以下のURLをコピーしてください。", url);
    }
}

// ========================================
// 画像読み込み
// ========================================

function readImage(file) {
    return new Promise((resolve, reject) => {

        if (!file) {
            resolve(null);
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            reject(new Error(
                "JPEG、PNG、WEBP、GIF画像を選択してください。"
            ));
            return;
        }

        // 画像サイズ上限：8MB
        if (file.size > 8 * 1024 * 1024) {
            reject(new Error(
                "画像サイズは8MB以下にしてください。"
            ));
            return;
        }

        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.onerror = () => reject(
            new Error("画像を読み込めませんでした。")
        );

        reader.readAsDataURL(file);
    });
}

// ========================================
// 画像プレビュー
// ========================================

async function showImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    preview.innerHTML = "";

    const file = input.files[0];

    if (!file) return;

    try {
        const image = await readImage(file);

        const img = document.createElement("img");
        img.src = image;
        img.alt = "画像プレビュー";

        preview.appendChild(img);

    } catch (error) {
        alert(error.message);
        input.value = "";
    }
}

// ========================================
// スレッド一覧
// ========================================

async function renderThreads() {
    const threadList = document.getElementById("threadList");
    const threadCount = document.getElementById("threadCount");

    threadList.innerHTML = "<p>スレッドを読み込んでいます...</p>";

    try {
        const threads = await Works.getThreads();

        const keyword = currentSearch.toLowerCase();

        const filteredThreads = threads.filter(thread => {
            return (
                (thread.title || "").toLowerCase().includes(keyword) ||
                (thread.content || "").toLowerCase().includes(keyword) ||
                (thread.category || "").toLowerCase().includes(keyword)
            );
        });

        threadCount.textContent = filteredThreads.length + "件";

        if (filteredThreads.length === 0) {
            threadList.innerHTML =
                "<p>該当するスレッドはありません。</p>";
            return;
        }

        threadList.innerHTML = filteredThreads.map(thread => `
            <article class="thread-card" data-id="${escapeHTML(thread.id)}">

                <div class="thread-meta">
                    <span class="thread-category">
                        ${escapeHTML(thread.category)}
                    </span>

                    <span>匿名ユーザー</span>

                    <span>${formatDate(thread.createdAt)}</span>
                </div>

                <h3>${escapeHTML(thread.title)}</h3>

                <p>${escapeHTML((thread.content || "").slice(0, 120))}</p>

                <p>コメント：${(thread.comments || []).length}件</p>

                <button type="button" class="open-thread">
                    スレッドを見る
                </button>

            </article>
        `).join("");

    } catch (error) {
        console.error("スレッド一覧の表示エラー:", error);
        threadList.innerHTML =
            "<p>スレッドを読み込めませんでした。時間をおいて再度お試しください。</p>";
    }
}

// ========================================
// スレッド詳細
// ========================================

async function openThread(threadId, updateHistory = true) {

    try {
        const threads = await Works.getThreads();

        const thread = threads.find(
            item => item.id === threadId
        );

        if (!thread) {
            alert("このスレッドは見つかりませんでした。削除されたか、URLが正しくない可能性があります。");

            if (updateHistory) {
                showThreadList();
            }

            return;
        }

        currentThreadId = threadId;
        replyParentId = null;

        if (updateHistory) {
            history.pushState(
                { threadId },
                "",
                getThreadURL(threadId)
            );
        }

        document.querySelector(".thread-section").hidden = true;
        document.querySelector(".search-section").hidden = true;
        document.querySelector(".dashboard-actions").hidden = true;
        document.querySelector(".report-section").hidden = true;

        document.getElementById("threadDetail").hidden = false;

        // スレッド本文
        document.getElementById("threadDetailContent").innerHTML = `
            <div class="thread-meta">
                <span class="thread-category">
                    ${escapeHTML(thread.category)}
                </span>

                <span>匿名ユーザー</span>

                <span>${formatDate(thread.createdAt)}</span>
            </div>

            <h2 id="post-1">
                No.1 ${escapeHTML(thread.title)}
            </h2>

            <p class="post-content">
                ${escapeHTML(thread.content)}
            </p>

            ${thread.image ? `
                <img
                    src="${escapeHTML(thread.image)}"
                    alt="投稿画像"
                    class="post-image"
                >
            ` : ""}

            <button type="button" id="detailReportButton">
                通報
            </button>
        `;

        // 検索欄リセット
        document.getElementById("threadSearchInput").value = "";
        document.getElementById("threadSearchResults").innerHTML = "";

        // コメント欄リセット
        document.getElementById("commentContent").value = "";
        document.getElementById("commentImage").value = "";
        document.getElementById("commentImagePreview").innerHTML = "";

        document.getElementById("replyTarget").innerHTML = "";
        document.getElementById("submitComment").textContent = "コメントする";

        renderComments(thread);

        window.scrollTo(0, 0);

    } catch (error) {
        console.error("スレッド詳細の取得エラー:", error);
        alert("スレッドを読み込めませんでした。");
    }
}

// ========================================
// 一覧に戻る
// ========================================

function showThreadList(updateHistory = true) {
    currentThreadId = null;
    replyParentId = null;

    if (updateHistory) {
        const url = new URL(window.location.href);
        url.searchParams.delete("thread");

        history.pushState({}, "", url.toString());
    }

    document.getElementById("threadDetail").hidden = true;

    document.querySelector(".thread-section").hidden = false;
    document.querySelector(".search-section").hidden = false;
    document.querySelector(".dashboard-actions").hidden = false;
    document.querySelector(".report-section").hidden = false;

    renderThreads();

    window.scrollTo(0, 0);
}

// ========================================
// 返信先リンク
// ========================================

function createReplyLink(parentId, numbers) {
    if (!parentId) return "";

    const parentNumber = numbers.get(parentId);

    if (!parentNumber) return "";

    return `
        <a
            href="#post-${parentNumber}"
            class="reply-link"
            data-target="${parentNumber}"
        >${parentNumber}</a>
    `;
}

// ========================================
// コメント・返信表示
// ========================================

function renderComments(thread) {
    const commentList = document.getElementById("commentList");

    if (!thread.comments || thread.comments.length === 0) {
        commentList.innerHTML = "<p>まだ投稿はありません。</p>";
        return;
    }

    const numbers = getPostNumbers(thread);

    commentList.innerHTML = thread.comments.map(comment => {

        const number = numbers.get(comment.id);

        const replyLink = createReplyLink(
            comment.parentId,
            numbers
        );

        return `
            <article
                class="board-post"
                id="post-${number}"
            >

                <div class="post-info">

                    <a
                        href="#post-${number}"
                        class="post-number"
                    >${number}</a>:

                    <span class="post-date">
                        ${formatDate(comment.createdAt)}
                    </span>

                    <span class="post-author">
                        匿名ユーザー
                    </span>

                    ${comment.parentId ? `
                        <span class="reply-info">
                            ↪ ${replyLink}
                        </span>
                    ` : ""}

                </div>

                <div class="post-content">
                    ${escapeHTML(comment.content)}
                </div>

                ${comment.image ? `
                    <img
                        src="${escapeHTML(comment.image)}"
                        alt="投稿画像"
                        class="post-image"
                    >
                ` : ""}

                <div class="post-actions">
                    <button
                        type="button"
                        class="reply-button"
                        data-id="${escapeHTML(comment.id)}"
                        data-number="${number}"
                    >
                        返信
                    </button>
                </div>

            </article>
        `;

    }).join("");
}

// ========================================
// 投稿番号へ移動
// ========================================

function scrollToPost(number) {
    const target = document.getElementById("post-" + number);

    if (!target) return;

    target.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    target.classList.add("post-highlight");

    setTimeout(() => {
        target.classList.remove("post-highlight");
    }, 2000);
}

// ========================================
// スレッド内検索
// ========================================

async function searchInsideThread() {
    const keyword = document.getElementById("threadSearchInput")
        .value.trim().toLowerCase();

    const results = document.getElementById("threadSearchResults");

    results.innerHTML = "";

    if (!keyword) {
        results.innerHTML = "<p>検索キーワードを入力してください。</p>";
        return;
    }

    try {
        const threads = await Works.getThreads();

        const thread = threads.find(
            item => item.id === currentThreadId
        );

        if (!thread) {
            results.innerHTML = "<p>スレッドが見つかりません。</p>";
            return;
        }

        const numbers = getPostNumbers(thread);
        const matches = [];

        if ((thread.content || "").toLowerCase().includes(keyword)) {
            matches.push({
                number: 1,
                type: "スレッド本文",
                content: thread.content
            });
        }

        thread.comments.forEach(comment => {
            if ((comment.content || "").toLowerCase().includes(keyword)) {
                matches.push({
                    number: numbers.get(comment.id),
                    type: comment.parentId ? "返信" : "コメント",
                    content: comment.content
                });
            }
        });

        if (matches.length === 0) {
            results.innerHTML = "<p>該当する投稿はありません。</p>";
            return;
        }

        results.innerHTML = `
            <div class="search-result-heading">
                ${matches.length}件見つかりました
            </div>

            ${matches.map(item => `
                <div class="search-result-item">

                    <strong>No.${item.number} ・ ${item.type}</strong>

                    <p>${escapeHTML(item.content.slice(0, 100))}</p>

                    <button
                        type="button"
                        class="search-result-button"
                        data-number="${item.number}"
                    >
                        この投稿へ移動
                    </button>

                </div>
            `).join("")}
        `;

    } catch (error) {
        console.error("スレッド内検索エラー:", error);
        results.innerHTML = "<p>検索に失敗しました。</p>";
    }
}

// ========================================
// 通報
// ========================================

async function reportThread(threadId) {
    const reason = prompt("通報理由を入力してください。");

    if (reason === null) return;

    if (!reason.trim()) {
        alert("通報理由を入力してください。");
        return;
    }

    try {
        const saved = await Works.reportThread(
            threadId,
            reason.trim()
        );

        alert(
            saved
                ? "通報を受け付けました。"
                : "通報を保存できませんでした。"
        );

    } catch (error) {
        console.error("通報エラー:", error);
        alert("通報に失敗しました。");
    }
}

// ========================================
// 初期設定
// ========================================

document.addEventListener("DOMContentLoaded", async function () {

    // ====================================
    // Supabase接続確認
    // ====================================

    if (!Works.isConnected()) {
        document.getElementById("threadList").innerHTML =
            "<p>データベースに接続できません。接続設定を確認してください。</p>";
        return;
    }

    // ====================================
    // スレッド一覧表示
    // ====================================

    await renderThreads();

    // ====================================
    // URLからスレッドを開く
    // ====================================

    const params = new URLSearchParams(window.location.search);
    const threadIdFromURL = params.get("thread");

    if (threadIdFromURL) {
        await openThread(threadIdFromURL, false);
    }

    // ====================================
    // コメント画像プレビュー
    // ====================================

    document.getElementById("commentImage")
        .addEventListener("change", function () {
            showImagePreview("commentImage", "commentImagePreview");
        });

    // ====================================
    // 全体検索
    // ====================================

    function searchThreads() {
        currentSearch = document.getElementById("searchInput")
            .value.trim().toLowerCase();

        renderThreads();
    }

    document.getElementById("searchButton")
        .addEventListener("click", searchThreads);

    document.getElementById("searchInput")
        .addEventListener("input", searchThreads);

    // ====================================
    // スレッド一覧の操作
    // ====================================

    document.getElementById("threadList")
        .addEventListener("click", function (event) {

            const card = event.target.closest(".thread-card");
            if (!card) return;

            const threadId = card.dataset.id;

            if (event.target.closest(".open-thread")) {
                openThread(threadId);
            }
        });

    // ====================================
    // URLコピー
    // ====================================

    document.getElementById("copyDetailURL")
        .addEventListener("click", copyThreadURL);

    // ====================================
    // 通報
    // ====================================

    document.getElementById("threadDetailContent")
        .addEventListener("click", function (event) {

            if (event.target.closest("#detailReportButton")) {
                reportThread(currentThreadId);
            }
        });

    // ====================================
    // 一覧に戻る
    // ====================================

    document.getElementById("backButton")
        .addEventListener("click", function () {
            showThreadList();
        });

    // ====================================
    // コメント・返信投稿
    // ====================================

    document.getElementById("commentForm")
        .addEventListener("submit", async function (event) {

            event.preventDefault();

            const content = document.getElementById("commentContent")
                .value.trim();

            const imageFile = document.getElementById("commentImage").files[0];

            if (!content && !imageFile) {
                alert("コメントまたは画像を入力してください。");
                return;
            }

            if (!currentThreadId) return;

            const button = document.getElementById("submitComment");
            button.disabled = true;
            button.textContent = "投稿中...";

            try {
                const image = await readImage(imageFile);

                const saved = await Works.addComment(
                    currentThreadId,
                    content,
                    replyParentId,
                    image
                );

                if (!saved) {
                    throw new Error(
                        "コメントを保存できませんでした。"
                    );
                }

                this.reset();

                document.getElementById("commentImagePreview").innerHTML = "";
                document.getElementById("replyTarget").innerHTML = "";

                replyParentId = null;
                button.textContent = "コメントする";

                const threads = await Works.getThreads();

                const thread = threads.find(
                    item => item.id === currentThreadId
                );

                if (thread) {
                    renderComments(thread);
                }

                await renderThreads();

            } catch (error) {
                console.error("コメント投稿エラー:", error);
                alert(error.message);
            } finally {
                button.disabled = false;

                if (replyParentId) {
                    button.textContent = "返信する";
                } else {
                    button.textContent = "コメントする";
                }
            }
        });

    // ====================================
    // 返信ボタン
    // ====================================

    document.getElementById("commentList")
        .addEventListener("click", function (event) {

            const button = event.target.closest(".reply-button");
            if (!button) return;

            replyParentId = button.dataset.id;

            const number = button.dataset.number;

            document.getElementById("commentContent").focus();

            document.getElementById("submitComment").textContent =
                "返信する";

            document.getElementById("replyTarget").innerHTML = `
                <p>
                    No.${number} に返信中
                    <button type="button" id="cancelReply">
                        解除
                    </button>
                </p>
            `;
        });

    // ====================================
    // 返信解除
    // ====================================

    document.getElementById("replyTarget")
        .addEventListener("click", function (event) {

            if (!event.target.closest("#cancelReply")) return;

            replyParentId = null;

            this.innerHTML = "";

            document.getElementById("submitComment").textContent =
                "コメントする";
        });

    // ====================================
    // 返信先リンク
    // ====================================

    document.getElementById("commentList")
        .addEventListener("click", function (event) {

            const link = event.target.closest(".reply-link");
            if (!link) return;

            event.preventDefault();

            scrollToPost(link.dataset.target);
        });

    // ====================================
    // 投稿番号リンク
    // ====================================

    document.getElementById("commentList")
        .addEventListener("click", function (event) {

            const link = event.target.closest(".post-number");
            if (!link) return;

            event.preventDefault();

            scrollToPost(link.textContent.trim());
        });

    // ====================================
    // スレッド内検索
    // ====================================

    document.getElementById("threadSearchButton")
        .addEventListener("click", searchInsideThread);

    document.getElementById("threadSearchInput")
        .addEventListener("input", searchInsideThread);

    document.getElementById("threadSearchInput")
        .addEventListener("keydown", function (event) {

            if (event.key === "Enter") {
                event.preventDefault();
                searchInsideThread();
            }
        });

    // ====================================
    // 検索結果から投稿へ移動
    // ====================================

    document.getElementById("threadSearchResults")
        .addEventListener("click", function (event) {

            const button = event.target.closest(".search-result-button");
            if (!button) return;

            scrollToPost(button.dataset.number);
        });

    // ====================================
    // ブラウザの戻る・進む
    // ====================================

    window.addEventListener("popstate", async function () {

        const params = new URLSearchParams(window.location.search);
        const threadId = params.get("thread");

        if (threadId) {
            await openThread(threadId, false);
        } else {
            showThreadList(false);
        }
    });

});
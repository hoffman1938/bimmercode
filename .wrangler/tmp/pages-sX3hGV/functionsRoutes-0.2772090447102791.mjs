import { onRequestPost as __api_auth_login_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/auth/login.js"
import { onRequestPost as __api_auth_register_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/auth/register.js"
import { onRequestPost as __api_forum_delete_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/delete.js"
import { onRequestPost as __api_forum_edit_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/edit.js"
import { onRequestPost as __api_forum_like_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/like.js"
import { onRequestPost as __api_forum_solve_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/solve.js"
import { onRequestPost as __api_user_update_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/user/update.js"
import { onRequest as __api_forum_topic_js_onRequest } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/topic.js"
import { onRequest as __api_forum_topics_js_onRequest } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/topics.js"
import { onRequestGet as __api_notifications_js_onRequestGet } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/notifications.js"
import { onRequestPost as __api_notifications_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/notifications.js"
import { onRequest as __api_upload_js_onRequest } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/upload.js"
import { onRequestGet as __images__filename__js_onRequestGet } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/images/[filename].js"

export const routes = [
    {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_js_onRequestPost],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_register_js_onRequestPost],
    },
  {
      routePath: "/api/forum/delete",
      mountPath: "/api/forum",
      method: "POST",
      middlewares: [],
      modules: [__api_forum_delete_js_onRequestPost],
    },
  {
      routePath: "/api/forum/edit",
      mountPath: "/api/forum",
      method: "POST",
      middlewares: [],
      modules: [__api_forum_edit_js_onRequestPost],
    },
  {
      routePath: "/api/forum/like",
      mountPath: "/api/forum",
      method: "POST",
      middlewares: [],
      modules: [__api_forum_like_js_onRequestPost],
    },
  {
      routePath: "/api/forum/solve",
      mountPath: "/api/forum",
      method: "POST",
      middlewares: [],
      modules: [__api_forum_solve_js_onRequestPost],
    },
  {
      routePath: "/api/user/update",
      mountPath: "/api/user",
      method: "POST",
      middlewares: [],
      modules: [__api_user_update_js_onRequestPost],
    },
  {
      routePath: "/api/forum/topic",
      mountPath: "/api/forum",
      method: "",
      middlewares: [],
      modules: [__api_forum_topic_js_onRequest],
    },
  {
      routePath: "/api/forum/topics",
      mountPath: "/api/forum",
      method: "",
      middlewares: [],
      modules: [__api_forum_topics_js_onRequest],
    },
  {
      routePath: "/api/notifications",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_notifications_js_onRequestGet],
    },
  {
      routePath: "/api/notifications",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_notifications_js_onRequestPost],
    },
  {
      routePath: "/api/upload",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_upload_js_onRequest],
    },
  {
      routePath: "/images/:filename",
      mountPath: "/images",
      method: "GET",
      middlewares: [],
      modules: [__images__filename__js_onRequestGet],
    },
  ]
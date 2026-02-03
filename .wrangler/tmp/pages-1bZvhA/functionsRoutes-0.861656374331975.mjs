import { onRequestPost as __api_auth_login_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/auth/login.js"
import { onRequestPost as __api_auth_register_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/auth/register.js"
import { onRequestPost as __api_auth_upload_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/auth/upload.js"
import { onRequestPost as __api_forum_like_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/like.js"
import { onRequestPost as __api_forum_solve_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/solve.js"
import { onRequest as __api_forum_topic_js_onRequest } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/topic.js"
import { onRequest as __api_forum_topics_js_onRequest } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/forum/topics.js"
import { onRequestGet as __api_notifications_js_onRequestGet } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/notifications.js"
import { onRequestPost as __api_notifications_js_onRequestPost } from "/Users/giorgi/Desktop/test1/bimmercode/Untitled/functions/api/notifications.js"

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
      routePath: "/api/auth/upload",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_upload_js_onRequestPost],
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
  ]
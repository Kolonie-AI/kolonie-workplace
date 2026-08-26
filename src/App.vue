<script setup lang="ts"></script>

<template>
  <main class="workplace">
    <h1 class="workplace__title">
      Kolonie Workplace
    </h1>
    <p class="workplace__note">
      The application shell is in place. Profession, venture, work items,
      recommendation and handover arrive in the issues that follow.
    </p>
  </main>
</template>

<style scoped>
.workplace {
  max-inline-size: 44rem;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  font-family: system-ui, sans-serif;
  color: #1c1f24;
}

.workplace__title {
  margin: 0 0 0.75rem;
  font-size: 1.75rem;
  line-height: 1.2;
}

.workplace__note {
  margin: 0;
  color: #5a6270;
  line-height: 1.5;
}
</style>

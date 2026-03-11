<script setup lang="ts">
const h = new Date().getHours()
let category = 'dinner'
if (h >= 5 && h < 10) category = 'breakfast'
else if (h >= 10 && h < 14) category = 'lunch'
else if (h >= 14 && h < 18) category = 'snack'

await navigateTo(`/add/${category}`, { replace: true })
</script>

<template>
  <div />
</template>

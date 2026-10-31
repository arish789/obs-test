package com.devopsark.test;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@SpringBootApplication
@RestController
@CrossOrigin(origins = "*")
public class Application {

    private static final Logger logger = LoggerFactory.getLogger(Application.class);

    private final List<Map<String, Object>> items = List.of(
            Map.of("id", 1, "name", "Java Item Alpha", "description", "Enterprise Java telemetry node."),
            Map.of("id", 2, "name", "Java Item Beta", "description", "Spring Web MVC workload."),
            Map.of("id", 3, "name", "Java Item Gamma", "description", "JVM tracing test service.")
    );

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        String now = Instant.now().toString();
        logger.info("[HEALTH] Java health probe requested at: {}", now);
        return ResponseEntity.ok(Map.of("status", "ok", "timestamp", now, "runtime", "java"));
    }

    @GetMapping("/api/items")
    public ResponseEntity<List<Map<String, Object>>> getItems() {
        logger.info("[ITEMS] Fetching Java items list, count: {}", items.size());
        return ResponseEntity.ok(items);
    }

    @GetMapping("/api/items/{id}")
    public ResponseEntity<?> getItem(@PathVariable int id) {
        logger.info("[ITEM-DETAIL] Fetching item ID: {}", id);
        return items.stream()
                .filter(i -> Objects.equals(i.get("id"), id))
                .findFirst()
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> {
                    logger.warn("[ITEM-DETAIL] Item ID {} not found", id);
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Item not found"));
                });
    }

    @GetMapping("/api/error-test")
    public ResponseEntity<?> errorTest() {
        logger.error("[TEST-ERROR] Simulated Java runtime exception for observability test");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Simulated Java error"));
    }
}

# ================================================================
# CMakeLists.txt - MEGA FLOWZ C++ Engine
# ================================================================

cmake_minimum_required(VERSION 3.20)
project(mega_engine VERSION 1.0.0 LANGUAGES CXX C)

# ── C++ Standard ──
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ================================================================
# FLATBUFFERS — fetch + build flatc + generate headers
# ================================================================

include(FetchContent)
FetchContent_Declare(
    flatbuffers
    GIT_REPOSITORY https://github.com/google/flatbuffers.git
    GIT_TAG        v23.5.26
)
set(FLATBUFFERS_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(FLATBUFFERS_BUILD_FLATC    ON  CACHE BOOL "" FORCE)
set(FLATBUFFERS_BUILD_FLATHASH OFF CACHE BOOL "" FORCE)
set(FLATBUFFERS_BUILD_GRPCTEST OFF CACHE BOOL "" FORCE)
set(FLATBUFFERS_INSTALL        OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(flatbuffers)

# ── Schema path ──
set(FBS_SCHEMA "${CMAKE_CURRENT_SOURCE_DIR}/schema/mega_flowz.fbs")

# ── C++ generated output ──
set(FBS_CPP_OUT "${CMAKE_CURRENT_SOURCE_DIR}/include/generated")
file(MAKE_DIRECTORY ${FBS_CPP_OUT})

# ── TypeScript generated output ──
set(FBS_TS_OUT "C:/Users/mega/mega_env/trading-project/src/generated")
file(MAKE_DIRECTORY ${FBS_TS_OUT})

# ── Generate C++ header ──
add_custom_command(
    OUTPUT  "${FBS_CPP_OUT}/mega_flowz_generated.h"
    COMMAND flatc
            --cpp
            --gen-mutable
            --reflect-names
            --natural-utf8
            -o "${FBS_CPP_OUT}"
            "${FBS_SCHEMA}"
    DEPENDS "${FBS_SCHEMA}" flatc
    COMMENT "Generating FlatBuffers C++ header"
    VERBATIM
)

# ── Generate TypeScript ──
add_custom_command(
    OUTPUT  "${FBS_TS_OUT}/mega_flowz_generated.ts"
    COMMAND flatc
            --ts
            --gen-mutable
            --natural-utf8
            -o "${FBS_TS_OUT}"
            "${FBS_SCHEMA}"
    DEPENDS "${FBS_SCHEMA}" flatc
    COMMENT "Generating FlatBuffers TypeScript"
    VERBATIM
)

# ── Generation targets ──
add_custom_target(flatbuffers_cpp
    DEPENDS "${FBS_CPP_OUT}/mega_flowz_generated.h"
)

add_custom_target(flatbuffers_ts
    DEPENDS "${FBS_TS_OUT}/mega_flowz_generated.ts"
)

# ================================================================
# FIND PYTHON
# ================================================================

find_package(Python3 REQUIRED COMPONENTS Interpreter Development)

# ── Find pybind11 ──
execute_process(
    COMMAND ${Python3_EXECUTABLE} -c "import pybind11; print(pybind11.get_cmake_dir())"
    OUTPUT_VARIABLE pybind11_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
find_package(pybind11 CONFIG REQUIRED HINTS ${pybind11_DIR})

# ================================================================
# USOCKETS
# ================================================================

set(USOCKETS_SOURCES
    libs/uSockets/src/bsd.c
    libs/uSockets/src/context.c
    libs/uSockets/src/loop.c
    libs/uSockets/src/socket.c
    libs/uSockets/src/udp.c
    libs/uSockets/src/eventing/libuv.c
)

set(USOCKETS_FILTERED)
foreach(f ${USOCKETS_SOURCES})
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/${f}")
        list(APPEND USOCKETS_FILTERED ${f})
    endif()
endforeach()

add_library(usockets STATIC ${USOCKETS_FILTERED})
target_include_directories(usockets PUBLIC
    libs/uSockets/src
    C:/msys64/mingw64/include
)
target_compile_definitions(usockets PUBLIC
    LIBUS_NO_SSL=1
    LIBUS_USE_LIBUV=1
)

# ================================================================
# MAIN EXECUTABLE
# ================================================================

include_directories(include)
include_directories(include/generated)
include_directories(libs)
include_directories(libs/uWebSockets/src)
include_directories(libs/uSockets/src)
include_directories(C:/msys64/mingw64/include)
include_directories(${Python3_INCLUDE_DIRS})

add_executable(mega_engine src/main.cpp)

# ── Must generate headers before compiling ──
add_dependencies(mega_engine
    flatbuffers_cpp
    flatbuffers_ts
)

target_link_libraries(mega_engine
    usockets
    flatbuffers
    pybind11::embed
    ${Python3_LIBRARIES}
    C:/msys64/mingw64/lib/libuv.dll.a
    ws2_32
    z
)

target_compile_definitions(mega_engine PRIVATE
    LIBUS_NO_SSL=1
    LIBUS_USE_LIBUV=1
)

if(MSVC)
    target_compile_options(mega_engine PRIVATE /W4 /O2)
else()
    target_compile_options(mega_engine PRIVATE -Wall -O2)
endif()

# ================================================================
# STATUS
# ================================================================

message(STATUS "MEGA FLOWZ Engine configured")
message(STATUS "Python:     ${Python3_VERSION}")
message(STATUS "Compiler:   ${CMAKE_CXX_COMPILER_ID}")
message(STATUS "Schema:     ${FBS_SCHEMA}")
message(STATUS "C++ out:    ${FBS_CPP_OUT}")
message(STATUS "TS out:     ${FBS_TS_OUT}")